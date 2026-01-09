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
  /**
   * OAS 3.2 document-level tags.
   */
  tags?: string[];
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  /**
   * A URI for the license used for the API. This MUST be in the form of a URI.
   * The url field is mutually exclusive of the identifier field.
   */
  url?: string;
  /**
   * OAS 3.1: An SPDX license expression for the API.
   * The identifier field is mutually exclusive of the url field.
   * @see https://spec.openapis.org/oas/v3.1.0#license-object
   */
  identifier?: string;
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
  /**
   * JSON Schema 2020-12: Declares which version of JSON Schema the schema conforms to.
   * @see https://json-schema.org/understanding-json-schema/reference/schema#schema
   */
  $schema?: string;
  /**
   * JSON Schema 2020-12: A URI-reference that identifies this schema.
   * @see https://json-schema.org/understanding-json-schema/structuring#id
   */
  $id?: string;
  /**
   * JSON Schema 2020-12: A location for schema authors to inline re-usable JSON Schemas.
   * Replaces the deprecated `definitions` keyword.
   * @see https://json-schema.org/understanding-json-schema/structuring#defs
   */
  $defs?: Record<string, SchemaObject | ReferenceObject>;
  /**
   * JSON Schema 2020-12: Enables dynamic referencing via `$dynamicRef`.
   * @see https://json-schema.org/understanding-json-schema/structuring#dynamicanchor-and-dynamicref
   */
  $dynamicAnchor?: string;
  /**
   * JSON Schema 2020-12: A dynamic reference to a schema with `$dynamicAnchor`.
   * @see https://json-schema.org/understanding-json-schema/structuring#dynamicanchor-and-dynamicref
   */
  $dynamicRef?: string;
  /**
   * JSON Schema 2020-12: A plain-name fragment identifier for use with JSON Pointer.
   * @see https://json-schema.org/understanding-json-schema/structuring#anchor
   */
  $anchor?: string;
  /**
   * JSON Schema 2020-12: Defines a single constant value that the instance must equal.
   * @see https://json-schema.org/understanding-json-schema/reference/const
   */
  const?: any;
  /**
   * JSON Schema 2020-12: Specifies the media type of the string contents.
   * @see https://json-schema.org/understanding-json-schema/reference/non_json_data#contentmediatype
   */
  contentMediaType?: string;
  /**
   * JSON Schema 2020-12: Specifies the encoding used to store the contents (e.g., "base64").
   * @see https://json-schema.org/understanding-json-schema/reference/non_json_data#contentencoding
   */
  contentEncoding?: string;
  /**
   * JSON Schema 2020-12: Specifies a schema to validate the decoded string content.
   * @see https://json-schema.org/understanding-json-schema/reference/non_json_data#contentschema
   */
  contentSchema?: SchemaObject | ReferenceObject;
  /**
   * JSON Schema 2020-12: Conditionally applies a subschema. If the `if` schema validates,
   * the `then` schema is applied; otherwise `else` is applied.
   * @see https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
   */
  if?: SchemaObject | ReferenceObject;
  /**
   * JSON Schema 2020-12: The schema to apply if `if` validates successfully.
   * @see https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
   */
  then?: SchemaObject | ReferenceObject;
  /**
   * JSON Schema 2020-12: The schema to apply if `if` fails validation.
   * @see https://json-schema.org/understanding-json-schema/reference/conditionals#if-then-else
   */
  else?: SchemaObject | ReferenceObject;
  /**
   * JSON Schema 2020-12: If a property is present, additional properties must validate
   * against the specified schema.
   * @see https://json-schema.org/understanding-json-schema/reference/conditionals#dependentschemas
   */
  dependentSchemas?: Record<string, SchemaObject | ReferenceObject>;
  /**
   * JSON Schema 2020-12: If a property is present, specified additional properties are required.
   * @see https://json-schema.org/understanding-json-schema/reference/conditionals#dependentrequired
   */
  dependentRequired?: Record<string, string[]>;
  /**
   * JSON Schema 2020-12: An array of schemas for tuple validation. Each item in the array
   * must validate against the schema at the same position.
   * Replaces the array form of `items` from draft-04.
   * @see https://json-schema.org/understanding-json-schema/reference/array#tupleValidation
   */
  prefixItems?: (SchemaObject | ReferenceObject)[];
  /**
   * JSON Schema 2020-12: Applies to any properties not covered by `properties`,
   * `patternProperties`, or `additionalProperties` in this schema or any subschema.
   * @see https://json-schema.org/understanding-json-schema/reference/object#unevaluatedproperties
   */
  unevaluatedProperties?: SchemaObject | ReferenceObject | boolean;
  /**
   * JSON Schema 2020-12: Applies to any items not evaluated by `items`, `prefixItems`,
   * or `contains` in this schema or any subschema.
   * @see https://json-schema.org/understanding-json-schema/reference/array#unevaluateditems
   */
  unevaluatedItems?: SchemaObject | ReferenceObject | boolean;
  /**
   * JSON Schema 2020-12: Validates that at least one item in an array matches the schema.
   * @see https://json-schema.org/understanding-json-schema/reference/array#contains
   */
  contains?: SchemaObject | ReferenceObject;
  /**
   * JSON Schema 2020-12: Minimum number of items that must match the `contains` schema.
   * @see https://json-schema.org/understanding-json-schema/reference/array#mincontains-maxcontains
   */
  minContains?: number;
  /**
   * JSON Schema 2020-12: Maximum number of items that must match the `contains` schema.
   * @see https://json-schema.org/understanding-json-schema/reference/array#mincontains-maxcontains
   */
  maxContains?: number;
  /**
   * JSON Schema 2020-12: A comment for schema authors. Not used for validation.
   * @see https://json-schema.org/understanding-json-schema/reference/comments
   */
  $comment?: string;
  /**
   * JSON Schema 2020-12: Specifies property names must validate against this schema.
   * @see https://json-schema.org/understanding-json-schema/reference/object#propertyNames
   */
  propertyNames?: SchemaObject | ReferenceObject;
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
  /**
   * Schema for array items. In JSON Schema 2020-12 (OAS 3.1+), when used with `prefixItems`,
   * `items` can be `false` to disallow additional items beyond the tuple definition.
   */
  items?: SchemaObject | ReferenceObject | boolean;
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
  /**
   * OAS 3.0 (JSON Schema draft-04): boolean flag paired with `maximum`.
   * OAS 3.1+ (JSON Schema 2020-12): number boundary value.
   */
  exclusiveMaximum?: boolean | number;
  minimum?: number;
  /**
   * OAS 3.0 (JSON Schema draft-04): boolean flag paired with `minimum`.
   * OAS 3.1+ (JSON Schema 2020-12): number boundary value.
   */
  exclusiveMinimum?: boolean | number;
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
