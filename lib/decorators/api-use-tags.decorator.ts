import { DECORATORS } from '../constants.js';
import { createMixedDecorator } from './helpers.js';

/**
 * @publicApi
 */
export function ApiTags(...tags: string[]) {
  return createMixedDecorator(DECORATORS.API_TAGS, tags);
}
