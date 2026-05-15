import type {
  StandardJSONSchemaV1,
  StandardSchemaV1
} from '@standard-schema/spec';
import {
  ReferenceObject,
  SchemaObject
} from './open-api-spec.interface.js';

export type OperationIdFactory = (
  controllerKey: string,
  methodKey: string,
  version?: string
) => string;

export type StandardJsonSchemaConverter = StandardJSONSchemaV1.Converter;

export type StandardSchemaObject = StandardSchemaV1 | StandardJSONSchemaV1;

export interface StandardSchemaConversionResult {
  schema: SchemaObject | ReferenceObject;
  components?: Record<string, SchemaObject>;
}

export type StandardSchemaConverter = (
  schema: StandardSchemaObject,
  options: {
    schemaType: 'input' | 'output';
  }
) => StandardSchemaConversionResult | undefined;

/**
 * @publicApi
 */
export interface SwaggerDocumentOptions {
  /**
   * List of modules to include in the specification
   */
  include?: Function[];

  /**
   * Additional, extra models that should be inspected and included in the specification
   */
  extraModels?: Function[];

  /**
   * If `true`, swagger will ignore the global prefix set through `setGlobalPrefix()` method
   */
  ignoreGlobalPrefix?: boolean;

  /**
   * If `true`, swagger will also load routes from the modules imported by `include` modules
   */
  deepScanRoutes?: boolean;

  /**
   * Custom operationIdFactory that will be used to generate the `operationId`
   * based on the `controllerKey`, `methodKey`, and version.
   * @default () => controllerKey_methodKey_version
   */
  operationIdFactory?: OperationIdFactory;

  /**
   * Custom linkNameFactory that will be used to generate the name of links
   * in the `links` field of responses
   *
   * @see [Link objects](https://swagger.io/docs/specification/links/)
   *
   * @default () => `${controllerKey}_${methodKey}_from_${fieldKey}`
   */
  linkNameFactory?: (
    controllerKey: string,
    methodKey: string,
    fieldKey: string
  ) => string;

  /*
   * Generate tags automatically based on the controller name.
   * If `false`, you must use the `@ApiTags()` decorator to define tags.
   * Otherwise, the controller name without the suffix `Controller` will be used.
   * @default true
   */
  autoTagControllers?: boolean;

  /**
   * Optional adapter that converts a Standard Schema instance supplied to Nest
   * route decorators into an OpenAPI schema.
   */
  standardSchemaConverter?: StandardSchemaConverter;
}
