import { DECORATORS } from '../constants';
import { TagObject } from '../interfaces/open-api-spec.interface';
import { ApiTags } from './api-use-tags.decorator';

export type ApiTagKind = 'audience' | 'badge' | 'nav' | (string & {});
/**
 * @deprecated Use `ApiTagKind`.
 */
export type ApiTagGroupKind = ApiTagKind;

export interface ApiTagOptions extends Pick<
  TagObject,
  | 'name'
  | 'summary'
  | 'x-displayName'
  | 'description'
  | 'externalDocs'
  | 'parent'
  | 'kind'
> {
  name: string;
  summary?: string;
  'x-displayName'?: string;
  description?: string;
  externalDocs?: TagObject['externalDocs'];
  parent?: string;
  kind?: ApiTagKind;
}

/**
 * OAS 3.2 Enhanced Tags support (nested tag groups).
 *
 * When used at the controller (class) level, this decorator:
 * - keeps existing operation `tags` behavior (via `@ApiTags(name)`)
 * - provides additional tag metadata (`parent`, `kind`) to be injected into
 *   the top-level OpenAPI `tags` array during document generation.
 *
 * @publicApi
 */
export function ApiTag(options: ApiTagOptions): ClassDecorator {
  return (target: Function) => {
    const previous: ApiTagOptions[] =
      Reflect.getMetadata(DECORATORS.API_TAG_GROUP, target) || [];
    Reflect.defineMetadata(
      DECORATORS.API_TAG_GROUP,
      [...previous, options],
      target
    );

    // Ensure operations are tagged consistently.
    ApiTags(options.name)(target as any);
    return target as any;
  };
}

/**
 * @deprecated Use `ApiTag(options)` instead. This alias will be removed in a
 * future major version.
 *
 * @publicApi
 */
export function ApiTagGroup(options: ApiTagOptions): ClassDecorator {
  return ApiTag(options);
}

/**
 * @deprecated Use `ApiTagOptions`.
 */
export type ApiTagGroupOptions = ApiTagOptions;
