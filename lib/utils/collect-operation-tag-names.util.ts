import { OpenAPIObject } from '../interfaces/open-api-spec.interface';

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  /**
   * Non-standard methods supported by this fork.
   * Kept aligned with internal behavior.
   */
  'search',
  'query'
]);

export function collectOperationTagNames(
  paths?: OpenAPIObject['paths'],
  webhooks?: OpenAPIObject['webhooks']
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  const collectFromItems = (
    items?: OpenAPIObject['paths'] | OpenAPIObject['webhooks']
  ) => {
    if (!items) {
      return;
    }
    for (const pathItem of Object.values(items)) {
      if (!pathItem || typeof pathItem !== 'object') {
        continue;
      }
      for (const [key, operation] of Object.entries(pathItem as any)) {
        if (!HTTP_METHODS.has(String(key).toLowerCase())) {
          continue;
        }
        const tags = (operation as any)?.tags;
        if (!Array.isArray(tags)) {
          continue;
        }
        for (const t of tags) {
          if (typeof t !== 'string') {
            continue;
          }
          const trimmed = t.trim();
          if (!trimmed || seen.has(trimmed)) {
            continue;
          }
          seen.add(trimmed);
          names.push(trimmed);
        }
      }
    }
  };

  collectFromItems(paths);
  collectFromItems(webhooks);

  return names;
}

