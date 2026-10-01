import { DECORATORS } from '../constants.js';
import { createMethodDecorator } from './helpers.js';

/**
 * OAS 3.2 supports the HTTP QUERY method. This decorator allows explicitly
 * exposing a Nest handler as an OpenAPI `query` operation.
 *
 * @publicApi
 */
export function ApiQueryMethod(): MethodDecorator {
  return createMethodDecorator(DECORATORS.API_QUERY_METHOD, true);
}
