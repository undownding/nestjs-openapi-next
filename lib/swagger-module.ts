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
import { TagObject } from './interfaces/open-api-spec.interface';
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

/**
 * @publicApi
 */
export class SwaggerModule {
  private static readonly metadataLoader = new MetadataLoader();

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
      const list = groupToTags.get(parent)!;
      const seen = groupToSeen.get(parent)!;
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

    const mergedDocument: OpenAPIObject = {
      openapi: '3.0.0',
      paths: {},
      ...config,
      ...document,
      ...(mergedTags ? { tags: mergedTags } : {})
    };

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
