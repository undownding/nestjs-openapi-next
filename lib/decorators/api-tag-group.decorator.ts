import { DECORATORS } from '../constants';
import { TagObject } from '../interfaces/open-api-spec.interface';
import { ApiTags } from './api-use-tags.decorator';

export type ApiTagGroupKind = 'audience' | 'badge' | 'nav' | (string & {});

export interface ApiTagGroupOptions
  extends Pick<
    TagObject,
    'name' | 'summary' | 'description' | 'externalDocs' | 'parent' | 'kind'
  > {
  name: string;
  summary?: string;
  description?: string;
  externalDocs?: TagObject['externalDocs'];
  parent?: string;
  kind?: ApiTagGroupKind;
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
export function ApiTagGroup(options: ApiTagGroupOptions): ClassDecorator {
  return (target: Function) => {
    const previous: ApiTagGroupOptions[] =
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

