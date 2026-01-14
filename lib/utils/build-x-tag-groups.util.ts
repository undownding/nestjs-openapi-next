import { TagObject } from '../interfaces/open-api-spec.interface';

/**
 * Derive root-level `x-tagGroups` from Enhanced Tags (`parent`) metadata.
 *
 * This is a non-standard extension used by tooling like Redoc. We derive it
 * from `tags[].parent` so consumers that only use scan output (e.g. `.tags`
 * generation) still receive grouping information.
 */
export function buildXTagGroups(
  tags?: TagObject[],
  operationTagNames?: string[]
) {
  const opNames = new Set(
    (operationTagNames || [])
      .filter((t) => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
  );

  if ((!tags || tags.length === 0) && opNames.size === 0) {
    return undefined;
  }

  const groupToChildTags = new Map<string, string[]>();
  const groupToSeen = new Map<string, Set<string>>();
  const childToParent = new Map<string, string>();

  for (const tag of tags || []) {
    const parent = tag.parent;
    if (!parent) {
      continue;
    }
    childToParent.set(tag.name, parent);
    if (!groupToChildTags.has(parent)) {
      groupToChildTags.set(parent, []);
      groupToSeen.set(parent, new Set());
    }
    let list = groupToChildTags.get(parent);
    if (!list) {
      list = [];
      groupToChildTags.set(parent, list);
    }

    let seen = groupToSeen.get(parent);
    if (!seen) {
      seen = new Set();
      groupToSeen.set(parent, seen);
    }
    if (!seen.has(tag.name)) {
      seen.add(tag.name);
      list.push(tag.name);
    }
  }

  // Standalone groups: tags used by operations but not a child of any parent.
  for (const name of opNames) {
    if (childToParent.has(name)) {
      continue;
    }
    if (!groupToChildTags.has(name)) {
      groupToChildTags.set(name, []);
      groupToSeen.set(name, new Set());
    }
  }

  if (groupToChildTags.size === 0) {
    return undefined;
  }

  const allTagNames = new Set((tags || []).map((t) => t.name));

  return [...groupToChildTags.entries()].map(([name, childTags]) => {
    const finalTags: string[] = [];
    const seen = new Set<string>();

    // If a tag with the same name exists, include it first (common Redoc pattern).
    // Also include it when used by operations (even if not explicitly in tags[]).
    if (allTagNames.has(name) || opNames.has(name)) {
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
