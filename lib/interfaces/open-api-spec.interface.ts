/**
 * inspired by https://github.com/metadevpro/openapi3-ts
 * @see https://github.com/OAI/OpenAPI-Specification/blob/3.0.0-rc0/versions/3.0.md
 */

export interface OpenAPIObject {
  openapi: string;
  info: InfoObject;
  servers?: ServerObject[];
  paths: PathsObject;
  /**
   * OpenAPI 3.1: a map of out-of-band callbacks (webhooks) that may be initiated
   * by the API provider and sent to the API consumer.
   *
   * @see https://spec.openapis.org/oas/v3.1.0#webhooks-object
   */
  webhooks?: WebhooksObject;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  /**
   * Non-standard grouping extension supported by tools like Redoc.
   * @see https://redocly.com/docs/api-reference-docs/specification-extensions/x-tagGroups/
   */
  'x-tagGroups'?: Array<{
    name: string;
    tags: string[];
  }>;
  externalDocs?: ExternalDocumentationObject;
}

export interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface ServerObject {
  name?: string;
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject {
  enum?: string[] | boolean[] | number[];
  default: string | boolean | number;
  description?: string;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject | ReferenceObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
}

export type PathsObject = Record<string, PathItemObject>;
export type WebhooksObject = Record<string, PathItemObject>;
export interface PathItemObject {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  /**
   * Non-standard method supported by some tooling.
   * Kept for backward-compat with existing behavior.
   */
  search?: OperationObject;
  /**
   * OAS 3.2 HTTP QUERY method support.
   */
  query?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: (ParameterObject | ReferenceObject)[];
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses: ResponsesObject;
  callbacks?: CallbacksObject;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}

export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';
export type ParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';

export interface BaseParameterObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject | ReferenceObject;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  example?: any;
  content?: ContentObject;
}

export interface ParameterObject extends BaseParameterObject {
  name: string;
  in: ParameterLocation;
}

export interface RequestBodyObject {
  description?: string;
  content: ContentObject;
  required?: boolean;
}

export type ContentObject = Record<string, MediaTypeObject>;
export interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
  /**
   * OAS 3.2 streaming schema for individual items.
   */
  itemSchema?: SchemaObject | ReferenceObject;
  examples?: ExamplesObject;
  example?: any;
  encoding?: EncodingObject;
}

export type EncodingObject = Record<string, EncodingPropertyObject>;
export interface EncodingPropertyObject {
  contentType?: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface ResponsesObject extends Record<
  string,
  ResponseObject | ReferenceObject | undefined
> {
  default?: ResponseObject | ReferenceObject;
}

export interface ResponseObject {
  description: string;
  headers?: HeadersObject;
  content?: ContentObject;
  links?: LinksObject;
}

export type CallbacksObject = Record<string, CallbackObject | ReferenceObject>;
export type CallbackObject = Record<string, PathItemObject>;
export type HeadersObject = Record<string, HeaderObject | ReferenceObject>;

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export type LinksObject = Record<string, LinkObject | ReferenceObject>;
export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: LinkParametersObject;
  requestBody?: unknown;
  description?: string;
  server?: ServerObject;
}

export type LinkParametersObject = Record<string, unknown>;
export type HeaderObject = BaseParameterObject;
export interface TagObject {
  name: string;
  /**
   * OAS 3.2 adds a short display summary for tags.
   */
  summary?: string;
  /**
   * Non-standard display name extension used by some tooling (e.g. Redoc).
   * Equivalent to `summary` in this fork (we mirror values when either is set).
   */
  'x-displayName'?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  /**
   * OAS 3.2 Enhanced Tags (nested tags).
   */
  parent?: string;
  /**
   * OAS 3.2 Enhanced Tags (tag kind).
   */
  kind?: 'audience' | 'badge' | 'nav' | (string & {});
}

export type ExamplesObject = Record<string, ExampleObject | ReferenceObject>;

export interface ReferenceObject {
  $ref: string;
  /**
   * OAS 3.1: A short summary which by default should override that of the referenced component.
   * @see https://spec.openapis.org/oas/v3.1.0#reference-object
   */
  summary?: string;
  /**
   * OAS 3.1: A description which by default should override that of the referenced component.
   * @see https://spec.openapis.org/oas/v3.1.0#reference-object
   */
  description?: string;
}

export interface SchemaObject {
  nullable?: boolean;
  discriminator?: DiscriminatorObject;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: XmlObject;
  externalDocs?: ExternalDocumentationObject;
  example?: any;
  examples?: any[] | Record<string, any>;
  deprecated?: boolean;
  type?: string | string[];
  allOf?: (SchemaObject | ReferenceObject)[];
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  not?: SchemaObject | ReferenceObject;
  items?: SchemaObject | ReferenceObject;
  properties?: Record<string, SchemaObject | ReferenceObject>;
  additionalProperties?: SchemaObject | ReferenceObject | boolean;
  patternProperties?:
    | Record<string, SchemaObject | ReferenceObject>
    | undefined;
  description?: string;
  format?: string;
  default?: any;
  title?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  'x-enumNames'?: string[];
}

export type SchemasObject = Record<string, SchemaObject>;

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface XmlObject {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

export interface SecuritySchemeObject {
  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
  'x-tokenName'?: string;

  /**
   * SecuritySchemes Additional extension properties
   * @issue https://github.com/nestjs/swagger/issues/3179
   * @see https://swagger.io/docs/specification/v3_0/openapi-extensions/
   */
  [extension: `x-${string}`]: any;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
  /**
   * OAS 3.2 OAuth 2.0 Device Authorization Flow (RFC 8628).
   */
  deviceAuthorization?: OAuthDeviceAuthorizationFlowObject;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: ScopesObject;
}

export interface OAuthDeviceAuthorizationFlowObject {
  deviceAuthorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: ScopesObject;
}

export type ScopesObject = Record<string, any>;
export type SecurityRequirementObject = Record<string, string[]>;

export type ExtensionLocation = 'root' | 'info';
