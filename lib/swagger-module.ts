import { INestApplication, NotFoundException } from '@nestjs/common';
import { HttpServer } from '@nestjs/common/interfaces/http/http-server.interface';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as jsyaml from 'js-yaml';
import {
  OpenAPIObject,
  SwaggerCustomOptions,
  SwaggerDocumentOptions
} from './interfaces';
import {
  CallbackObject,
  CallbacksObject,
  ContentObject,
  HeaderObject,
  HeadersObject,
  MediaTypeObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
  TagObject
} from './interfaces/open-api-spec.interface';
import { MetadataLoader } from './plugin/metadata-loader';
import { SwaggerScanner } from './swagger-scanner';
import {
  buildSwaggerHTML,
  buildSwaggerInitJS,
  getSwaggerAssetsAbsoluteFSPath
} from './swagger-ui';
import { assignTwoLevelsDeep } from './utils/assign-two-levels-deep';
import { getGlobalPrefix } from './utils/get-global-prefix';
import { normalizeRelPath } from './utils/normalize-rel-path';
import { resolvePath } from './utils/resolve-path.util';
import { validateGlobalPrefix } from './utils/validate-global-prefix.util';
import { validatePath } from './utils/validate-path.util';

const NULL_TYPE_SCHEMA: SchemaObject = { type: 'null' };

function isReferenceObject(
  value: ReferenceObject | Record<string, any>
): value is ReferenceObject {
  return !!(value as ReferenceObject)?.$ref;
}

function isOas31OrAbove(openapi?: string): boolean {
  const [majorStr, minorStr] = (openapi || '').split('.');
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    return false;
  }
  return major > 3 || (major === 3 && minor >= 1);
}

function appendNullOption(
  schemas: Array<SchemaObject | ReferenceObject>
): Array<SchemaObject | ReferenceObject> {
  const hasNull = schemas.some(
    (item) =>
      !isReferenceObject(item) &&
      (item.type === 'null' ||
        (Array.isArray(item.type) && item.type.includes('null')))
  );
  return hasNull ? schemas : schemas.concat(NULL_TYPE_SCHEMA);
}

function normalizeNullableSchema(
  schema?: SchemaObject | ReferenceObject
): SchemaObject | ReferenceObject | undefined {
  if (!schema) {
    return schema;
  }
  if (isReferenceObject(schema)) {
    return schema;
  }

  const converted: SchemaObject = { ...schema };

  if (converted.properties) {
    converted.properties = Object.entries(converted.properties).reduce(
      (acc, [key, value]) => {
        acc[key] = normalizeNullableSchema(value);
        return acc;
      },
      {} as Record<string, SchemaObject | ReferenceObject>
    );
  }

  if (converted.patternProperties) {
    converted.patternProperties = Object.entries(
      converted.patternProperties
    ).reduce(
      (acc, [key, value]) => {
        acc[key] = normalizeNullableSchema(value);
        return acc;
      },
      {} as Record<string, SchemaObject | ReferenceObject>
    );
  }

  if (
    converted.additionalProperties &&
    typeof converted.additionalProperties === 'object'
  ) {
    converted.additionalProperties = normalizeNullableSchema(
      converted.additionalProperties
    );
  }

  if (converted.items && typeof converted.items !== 'boolean') {
    converted.items = normalizeNullableSchema(converted.items);
  }

  if (converted.allOf) {
    converted.allOf = converted.allOf.map((item) =>
      normalizeNullableSchema(item)
    );
  }
  if (converted.oneOf) {
    converted.oneOf = converted.oneOf.map((item) =>
      normalizeNullableSchema(item)
    );
  }
  if (converted.anyOf) {
    converted.anyOf = converted.anyOf.map((item) =>
      normalizeNullableSchema(item)
    );
  }
  if (converted.not) {
    converted.not = normalizeNullableSchema(converted.not) as SchemaObject;
  }

  /**
   * OAS 3.1+ uses JSON Schema 2020-12 semantics where `exclusiveMinimum` and
   * `exclusiveMaximum` are numeric boundary values (not boolean flags).
   *
   * We normalize common OAS 3.0 style inputs:
   * - minimum + exclusiveMinimum: true  => exclusiveMinimum: minimum (and drop minimum)
   * - maximum + exclusiveMaximum: true  => exclusiveMaximum: maximum (and drop maximum)
   */
  const exclusiveMinimum = converted.exclusiveMinimum;
  if (typeof exclusiveMinimum === 'boolean') {
    if (exclusiveMinimum === true && typeof converted.minimum === 'number') {
      converted.exclusiveMinimum = converted.minimum;
      delete converted.minimum;
    } else {
      delete converted.exclusiveMinimum;
    }
  }

  const exclusiveMaximum = converted.exclusiveMaximum;
  if (typeof exclusiveMaximum === 'boolean') {
    if (exclusiveMaximum === true && typeof converted.maximum === 'number') {
      converted.exclusiveMaximum = converted.maximum;
      delete converted.maximum;
    } else {
      delete converted.exclusiveMaximum;
    }
  }

  const isNullable = converted.nullable === true;
  if (converted.nullable !== undefined) {
    delete converted.nullable;
  }
  if (!isNullable) {
    return converted;
  }

  if (converted.type !== undefined) {
    const types = Array.isArray(converted.type)
      ? converted.type
      : [converted.type];
    converted.type = types.includes('null') ? types : [...types, 'null'];
    return converted;
  }

  if (converted.oneOf) {
    converted.oneOf = appendNullOption(converted.oneOf);
    return converted;
  }

  if (converted.anyOf) {
    converted.anyOf = appendNullOption(converted.anyOf);
    return converted;
  }

  if (converted.allOf) {
    return {
      anyOf: appendNullOption([converted])
    };
  }

  return {
    anyOf: appendNullOption([converted])
  };
}

function transformMediaType(mediaType: MediaTypeObject): MediaTypeObject {
  const transformed: MediaTypeObject = { ...mediaType };
  if (mediaType.schema) {
    transformed.schema = normalizeNullableSchema(mediaType.schema);
  }
  if (mediaType.itemSchema) {
    transformed.itemSchema = normalizeNullableSchema(mediaType.itemSchema);
  }
  return transformed;
}

function transformContent(content?: ContentObject): ContentObject | undefined {
  if (!content) {
    return content;
  }
  return Object.entries(content).reduce((acc, [key, value]) => {
    acc[key] = transformMediaType(value);
    return acc;
  }, {} as ContentObject);
}

function transformParameter(
  parameter: ParameterObject | ReferenceObject
): ParameterObject | ReferenceObject {
  if (isReferenceObject(parameter)) {
    return parameter;
  }
  const transformed: ParameterObject = { ...parameter };
  if (parameter.schema) {
    transformed.schema = normalizeNullableSchema(parameter.schema);
  }
  if (parameter.content) {
    transformed.content =
      transformContent(parameter.content) || parameter.content;
  }
  return transformed;
}

function transformHeaders(headers?: HeadersObject): HeadersObject | undefined {
  if (!headers) {
    return headers;
  }
  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (isReferenceObject(value as any)) {
      acc[key] = value as ReferenceObject;
      return acc;
    }
    const header = value as HeaderObject;
    const transformed: HeaderObject = { ...header };
    if (header.schema) {
      transformed.schema = normalizeNullableSchema(header.schema);
    }
    if (header.content) {
      transformed.content = transformContent(header.content) || header.content;
    }
    acc[key] = transformed;
    return acc;
  }, {} as HeadersObject);
}

function transformRequestBody(
  requestBody: RequestBodyObject | ReferenceObject
): RequestBodyObject | ReferenceObject {
  if (isReferenceObject(requestBody)) {
    return requestBody;
  }
  const transformed: RequestBodyObject = { ...requestBody };
  if (requestBody.content) {
    transformed.content =
      transformContent(requestBody.content) || requestBody.content;
  }
  return transformed;
}

function transformResponse(
  response: ResponseObject | ReferenceObject
): ResponseObject | ReferenceObject {
  if (isReferenceObject(response)) {
    return response;
  }
  const transformed: ResponseObject = { ...response };
  if (response.content) {
    transformed.content =
      transformContent(response.content) || response.content;
  }
  if (response.headers) {
    transformed.headers =
      transformHeaders(response.headers) || response.headers;
  }
  return transformed;
}

function transformResponses(responses: ResponsesObject): ResponsesObject {
  return Object.entries(responses).reduce((acc, [status, response]) => {
    if (response === undefined) {
      acc[status] = response;
      return acc;
    }
    acc[status] = transformResponse(response);
    return acc;
  }, {} as ResponsesObject);
}

function transformCallbacks(callbacks: CallbacksObject): CallbacksObject {
  return Object.entries(callbacks).reduce((acc, [name, callback]) => {
    if (isReferenceObject(callback as any)) {
      acc[name] = callback;
      return acc;
    }
    const transformedCallback: CallbackObject = {};
    Object.entries(callback as CallbackObject).forEach(([path, pathItem]) => {
      transformedCallback[path] = transformPathItem(pathItem);
    });
    acc[name] = transformedCallback;
    return acc;
  }, {} as CallbacksObject);
}

function transformOperation(operation: OperationObject): OperationObject {
  const transformed: OperationObject = { ...operation };
  if (operation.parameters) {
    transformed.parameters = operation.parameters.map(transformParameter);
  }
  if (operation.requestBody) {
    transformed.requestBody = transformRequestBody(operation.requestBody);
  }
  if (operation.responses) {
    transformed.responses = transformResponses(operation.responses);
  }
  if (operation.callbacks) {
    transformed.callbacks = transformCallbacks(operation.callbacks);
  }
  return transformed;
}

function transformPathItem(pathItem: PathItemObject): PathItemObject {
  const transformed: PathItemObject = { ...pathItem };
  if (pathItem.parameters) {
    transformed.parameters = pathItem.parameters.map(transformParameter);
  }

  const operationKeys: Array<keyof PathItemObject> = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
    'search',
    'query'
  ];

  operationKeys.forEach((operationKey) => {
    const operation = pathItem[operationKey];
    if (operation) {
      (transformed as any)[operationKey] = transformOperation(
        operation as OperationObject
      );
    }
  });

  return transformed;
}

function transformPathItems(
  paths?: Record<string, PathItemObject>
): Record<string, PathItemObject> | undefined {
  if (!paths) {
    return paths;
  }
  return Object.entries(paths).reduce(
    (acc, [path, pathItem]) => {
      acc[path] = transformPathItem(pathItem);
      return acc;
    },
    {} as Record<string, PathItemObject>
  );
}

function normalizeNullableForOas31(document: OpenAPIObject) {
  if (document.components?.schemas) {
    Object.entries(document.components.schemas).forEach(([name, schema]) => {
      document.components.schemas[name] = normalizeNullableSchema(schema);
    });
  }

  if (document.components?.parameters) {
    Object.entries(document.components.parameters).forEach(
      ([name, parameter]) => {
        document.components.parameters[name] = transformParameter(parameter);
      }
    );
  }

  if (document.components?.requestBodies) {
    Object.entries(document.components.requestBodies).forEach(
      ([name, body]) => {
        document.components.requestBodies[name] = transformRequestBody(body);
      }
    );
  }

  if (document.components?.responses) {
    Object.entries(document.components.responses).forEach(
      ([name, response]) => {
        document.components.responses[name] = transformResponse(response);
      }
    );
  }

  if (document.components?.headers) {
    document.components.headers =
      transformHeaders(document.components.headers) ||
      document.components.headers;
  }

  if (document.components?.callbacks) {
    document.components.callbacks = transformCallbacks(
      document.components.callbacks
    );
  }

  document.paths = transformPathItems(document.paths) || {};
  if (document.webhooks) {
    document.webhooks = transformPathItems(document.webhooks);
  }
}

/**
 * @publicApi
 */
export class SwaggerModule {
  private static readonly metadataLoader = new MetadataLoader();

  private static mergeWebhooks(
    configWebhooks?: OpenAPIObject['webhooks'],
    scannedWebhooks?: OpenAPIObject['webhooks']
  ): OpenAPIObject['webhooks'] | undefined {
    if (!configWebhooks && !scannedWebhooks) {
      return undefined;
    }
    return assignTwoLevelsDeep({}, configWebhooks || {}, scannedWebhooks || {});
  }

  private static mergeTags(
    configTags?: TagObject[],
    scannedTags?: TagObject[]
  ): TagObject[] | undefined {
    const byName = new Map<string, TagObject>();

    for (const tag of configTags || []) {
      if (!tag?.name) {
        continue;
      }
      byName.set(tag.name, { ...tag });
    }

    for (const tag of scannedTags || []) {
      if (!tag?.name) {
        continue;
      }
      const existing = byName.get(tag.name) || { name: tag.name };
      const merged: TagObject = { name: tag.name };

      // Prefer explicit config values for standard fields, but allow scanned
      // decorators to fill gaps.
      const existingDisplayName = existing['x-displayName'];
      const scannedDisplayName = tag['x-displayName'];
      const normalizedDisplayName =
        existingDisplayName ??
        existing.summary ??
        scannedDisplayName ??
        tag.summary;
      const normalizedSummary =
        existing.summary ??
        existingDisplayName ??
        tag.summary ??
        scannedDisplayName;

      merged.summary = normalizedSummary;
      merged['x-displayName'] = normalizedDisplayName;
      merged.description = existing.description ?? tag.description;
      merged.externalDocs = existing.externalDocs ?? tag.externalDocs;

      // Enhanced tag fields: merge in scanned values unless already present.
      merged.parent = existing.parent ?? tag.parent;
      merged.kind = existing.kind ?? tag.kind;

      byName.set(tag.name, merged);
    }

    const merged = [...byName.values()];
    return merged.length > 0 ? merged : undefined;
  }

  private static buildXTagGroups(tags?: TagObject[]) {
    if (!tags || tags.length === 0) {
      return undefined;
    }

    const groupToTags = new Map<string, string[]>();
    const groupToSeen = new Map<string, Set<string>>();

    for (const tag of tags) {
      const parent = tag.parent;
      if (!parent) {
        continue;
      }
      if (!groupToTags.has(parent)) {
        groupToTags.set(parent, []);
        groupToSeen.set(parent, new Set());
      }
      let list = groupToTags.get(parent);
      if (!list) {
        list = [];
        groupToTags.set(parent, list);
      }

      let seen = groupToSeen.get(parent);
      if (!seen) {
        seen = new Set();
        groupToSeen.set(parent, seen);
      }
      if (!seen.has(tag.name)) {
        seen.add(tag.name);
        list.push(tag.name);
      }
    }

    if (groupToTags.size === 0) {
      return undefined;
    }

    const allTagNames = new Set(tags.map((t) => t.name));

    return [...groupToTags.entries()].map(([name, childTags]) => {
      const finalTags: string[] = [];
      const seen = new Set<string>();

      // If a tag with the same name exists, include it first (common Redoc pattern).
      if (allTagNames.has(name)) {
        seen.add(name);
        finalTags.push(name);
      }

      for (const t of childTags) {
        if (!seen.has(t)) {
          seen.add(t);
          finalTags.push(t);
        }
      }

      return { name, tags: finalTags };
    });
  }

  public static createDocument(
    app: INestApplication,
    config: Omit<OpenAPIObject, 'paths'>,
    options: SwaggerDocumentOptions = {}
  ): OpenAPIObject {
    const swaggerScanner = new SwaggerScanner();
    const document = swaggerScanner.scanApplication(app, options);

    document.components = assignTwoLevelsDeep(
      {},
      config.components,
      document.components
    );

    const mergedTags = SwaggerModule.mergeTags(config.tags, document.tags);
    const mergedWebhooks = SwaggerModule.mergeWebhooks(
      (config as any).webhooks,
      (document as any).webhooks
    );

    const mergedDocument: OpenAPIObject = {
      openapi: '3.0.0',
      paths: {},
      ...config,
      ...document,
      ...(mergedTags ? { tags: mergedTags } : {}),
      ...(mergedWebhooks ? { webhooks: mergedWebhooks } : {})
    };

    if (isOas31OrAbove(mergedDocument.openapi)) {
      normalizeNullableForOas31(mergedDocument);
    }

    // Auto-derive `x-tagGroups` from Enhanced Tags (`parent`) if not explicitly provided.
    if (mergedDocument['x-tagGroups'] === undefined) {
      const xTagGroups = SwaggerModule.buildXTagGroups(mergedDocument.tags);
      if (xTagGroups) {
        mergedDocument['x-tagGroups'] = xTagGroups;
      }
    }

    return mergedDocument;
  }

  public static async loadPluginMetadata(
    metadataFn: () => Promise<Record<string, any>>
  ) {
    const metadata = await metadataFn();
    return this.metadataLoader.load(metadata);
  }

  protected static serveStatic(
    finalPath: string,
    app: INestApplication,
    customStaticPath?: string
  ) {
    const httpAdapter = app.getHttpAdapter();

    // See <https://github.com/nestjs/swagger/issues/2543>
    const swaggerAssetsPath = customStaticPath
      ? resolvePath(customStaticPath)
      : getSwaggerAssetsAbsoluteFSPath();

    if (httpAdapter && httpAdapter.getType() === 'fastify') {
      (app as NestFastifyApplication).useStaticAssets({
        root: swaggerAssetsPath,
        prefix: finalPath,
        decorateReply: false
      });
    } else {
      (app as NestExpressApplication).useStaticAssets(swaggerAssetsPath, {
        prefix: finalPath
      });
    }
  }

  protected static serveDocuments(
    finalPath: string,
    urlLastSubdirectory: string,
    httpAdapter: HttpServer,
    documentOrFactory: OpenAPIObject | (() => OpenAPIObject),
    options: {
      ui: boolean;
      raw: boolean | Array<'json' | 'yaml'>;
      jsonDocumentUrl: string;
      yamlDocumentUrl: string;
      swaggerOptions: SwaggerCustomOptions;
    }
  ) {
    let document: OpenAPIObject;

    const getBuiltDocument = () => {
      if (!document) {
        document =
          typeof documentOrFactory === 'function'
            ? documentOrFactory()
            : documentOrFactory;
      }
      return document;
    };

    if (options.ui) {
      this.serveSwaggerUi(
        finalPath,
        urlLastSubdirectory,
        httpAdapter,
        getBuiltDocument,
        options.swaggerOptions
      );
    }

    /**
     * Serve JSON/YAML definitions based on the `raw` option:
     * - `true`: Serve both JSON and YAML definitions.
     * - `false`: Skip registering both JSON and YAML definitions.
     * - `Array<'json' | 'yaml'>`: Serve only the specified formats (e.g., `['json']` to serve only JSON).
     */
    if (
      options.raw === true ||
      (Array.isArray(options.raw) && options.raw.length > 0)
    ) {
      const serveJson = options.raw === true || options.raw.includes('json');
      const serveYaml = options.raw === true || options.raw.includes('yaml');

      this.serveDefinitions(httpAdapter, getBuiltDocument, options, {
        serveJson,
        serveYaml
      });
    }
  }

  protected static serveSwaggerUi(
    finalPath: string,
    urlLastSubdirectory: string,
    httpAdapter: HttpServer,
    getBuiltDocument: () => OpenAPIObject,
    swaggerOptions: SwaggerCustomOptions
  ) {
    const baseUrlForSwaggerUI = normalizeRelPath(`./${urlLastSubdirectory}/`);

    let swaggerUiHtml: string;
    let swaggerUiInitJS: string;

    httpAdapter.get(
      normalizeRelPath(`${finalPath}/swagger-ui-init.js`),
      (req, res) => {
        res.type('application/javascript');
        const document = getBuiltDocument();

        if (swaggerOptions.patchDocumentOnRequest) {
          const documentToSerialize = swaggerOptions.patchDocumentOnRequest(
            req,
            res,
            document
          );
          const swaggerInitJsPerRequest = buildSwaggerInitJS(
            documentToSerialize,
            swaggerOptions
          );
          return res.send(swaggerInitJsPerRequest);
        }

        if (!swaggerUiInitJS) {
          swaggerUiInitJS = buildSwaggerInitJS(document, swaggerOptions);
        }

        res.send(swaggerUiInitJS);
      }
    );

    /**
     * Covers assets fetched through a relative path when Swagger url ends with a slash '/'.
     * @see https://github.com/nestjs/swagger/issues/1976
     */
    try {
      httpAdapter.get(
        normalizeRelPath(
          `${finalPath}/${urlLastSubdirectory}/swagger-ui-init.js`
        ),
        (req, res) => {
          res.type('application/javascript');
          const document = getBuiltDocument();

          if (swaggerOptions.patchDocumentOnRequest) {
            const documentToSerialize = swaggerOptions.patchDocumentOnRequest(
              req,
              res,
              document
            );
            const swaggerInitJsPerRequest = buildSwaggerInitJS(
              documentToSerialize,
              swaggerOptions
            );
            return res.send(swaggerInitJsPerRequest);
          }

          if (!swaggerUiInitJS) {
            swaggerUiInitJS = buildSwaggerInitJS(document, swaggerOptions);
          }

          res.send(swaggerUiInitJS);
        }
      );
    } catch {
      /**
       * Error is expected when urlLastSubdirectory === ''
       * in that case that route is going to be duplicating the one above
       */
    }

    function serveSwaggerHtml(_: any, res: any) {
      res.type('text/html');

      if (!swaggerUiHtml) {
        swaggerUiHtml = buildSwaggerHTML(baseUrlForSwaggerUI, swaggerOptions);
      }

      res.send(swaggerUiHtml);
    }

    httpAdapter.get(finalPath, serveSwaggerHtml);
    httpAdapter.get(`${finalPath}/index.html`, serveSwaggerHtml);
    httpAdapter.get(`${finalPath}/LICENSE`, () => {
      throw new NotFoundException();
    });

    // fastify doesn't resolve 'routePath/' -> 'routePath', that's why we handle it manually
    try {
      httpAdapter.get(normalizeRelPath(`${finalPath}/`), serveSwaggerHtml);
    } catch {
      /**
       * When Fastify adapter is being used with the "ignoreTrailingSlash" configuration option set to "true",
       * declaration of the route "finalPath/" will throw an error because of the following conflict:
       * Method '${method}' already declared for route '${path}' with constraints '${JSON.stringify(constraints)}.
       * We can simply ignore that error here.
       */
    }
  }

  protected static serveDefinitions(
    httpAdapter: HttpServer,
    getBuiltDocument: () => OpenAPIObject,
    options: {
      jsonDocumentUrl: string;
      yamlDocumentUrl: string;
      swaggerOptions: SwaggerCustomOptions;
    },
    serveOptions: { serveJson: boolean; serveYaml: boolean }
  ) {
    if (serveOptions.serveJson) {
      httpAdapter.get(normalizeRelPath(options.jsonDocumentUrl), (req, res) => {
        res.type('application/json');
        const document = getBuiltDocument();

        const documentToSerialize = options.swaggerOptions
          .patchDocumentOnRequest
          ? options.swaggerOptions.patchDocumentOnRequest(req, res, document)
          : document;

        res.send(JSON.stringify(documentToSerialize));
      });
    }

    if (serveOptions.serveYaml) {
      httpAdapter.get(normalizeRelPath(options.yamlDocumentUrl), (req, res) => {
        res.type('text/yaml');
        const document = getBuiltDocument();

        const documentToSerialize = options.swaggerOptions
          .patchDocumentOnRequest
          ? options.swaggerOptions.patchDocumentOnRequest(req, res, document)
          : document;

        const yamlDocument = jsyaml.dump(documentToSerialize, {
          skipInvalid: true,
          noRefs: true
        });
        res.send(yamlDocument);
      });
    }
  }

  public static setup(
    path: string,
    app: INestApplication,
    documentOrFactory: OpenAPIObject | (() => OpenAPIObject),
    options?: SwaggerCustomOptions
  ) {
    const globalPrefix = getGlobalPrefix(app);
    const finalPath = validatePath(
      options?.useGlobalPrefix && validateGlobalPrefix(globalPrefix)
        ? `${globalPrefix}${validatePath(path)}`
        : path
    );
    const urlLastSubdirectory = finalPath.split('/').slice(-1).pop() || '';
    const validatedGlobalPrefix =
      options?.useGlobalPrefix && validateGlobalPrefix(globalPrefix)
        ? validatePath(globalPrefix)
        : '';

    const finalJSONDocumentPath = options?.jsonDocumentUrl
      ? `${validatedGlobalPrefix}${validatePath(options.jsonDocumentUrl)}`
      : `${finalPath}-json`;

    const finalYAMLDocumentPath = options?.yamlDocumentUrl
      ? `${validatedGlobalPrefix}${validatePath(options.yamlDocumentUrl)}`
      : `${finalPath}-yaml`;

    const ui = options?.ui ?? options?.swaggerUiEnabled ?? true;
    const raw = options?.raw ?? true;

    const httpAdapter = app.getHttpAdapter();

    SwaggerModule.serveDocuments(
      finalPath,
      urlLastSubdirectory,
      httpAdapter,
      documentOrFactory,
      {
        ui,
        raw,
        jsonDocumentUrl: finalJSONDocumentPath,
        yamlDocumentUrl: finalYAMLDocumentPath,
        swaggerOptions: options || {}
      }
    );

    if (ui) {
      SwaggerModule.serveStatic(finalPath, app, options?.customSwaggerUiPath);
      /**
       * Covers assets fetched through a relative path when Swagger url ends with a slash '/'.
       * @see https://github.com/nestjs/swagger/issues/1976
       */
      if (finalPath === `/${urlLastSubdirectory}`) {
        return;
      }
      const serveStaticSlashEndingPath = `${finalPath}/${urlLastSubdirectory}`;
      SwaggerModule.serveStatic(serveStaticSlashEndingPath, app);
    }
  }
}
