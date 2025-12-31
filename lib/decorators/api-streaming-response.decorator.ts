import { Type } from '@nestjs/common';
import {
  ApiResponse,
  ApiResponseCommonMetadata
} from './api-response.decorator';

export interface ApiStreamingResponseOptions extends Omit<
  ApiResponseCommonMetadata,
  'type' | 'isArray' | 'content'
> {
  /**
   * Response media type for the stream, e.g. `text/event-stream`.
   */
  contentType: string;

  /**
   * Per-item schema type (stream element type).
   *
   * Example:
   * `type: () => SseItemDto`
   */
  type: () => Type<unknown> | Function | [Function] | string;
}

/**
 * OAS 3.2 streaming responses support via `itemSchema`.
 *
 * @publicApi
 */
export function ApiStreamingResponse(
  options: ApiStreamingResponseOptions
): MethodDecorator & ClassDecorator {
  const resolvedType = options.type?.();
  return ApiResponse({
    ...options,
    type: resolvedType as any,
    // Marker understood by ResponseObjectFactory
    isStreaming: true,
    contentType: options.contentType
  } as any);
}
