import { TagObject } from '../interfaces/open-api-spec.interface';

/**
 * Derive root-level `x-tagGroups` from Enhanced Tags (`parent`) metadata.
 *
 * This is a non-standard extension used by tooling like Redoc. We derive it
 * from `tags[].parent` so consumers that only use scan output (e.g. `.tags`
 * generation) still receive grouping information.
 */
export function buildXTagGroups(tags?: TagObject[]) {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const groupToTags = new Map<string, string[]>();
  const groupToSeen = new Map<string, Set<string>>();

  for (const tag of tags) {
    const parent = tag.parent;
    if (!parent) {
      continue;
    }
    if (!groupToTags.has(parent)) {
      groupToTags.set(parent, []);
      groupToSeen.set(parent, new Set());
    }
    let list = groupToTags.get(parent);
    if (!list) {
      list = [];
      groupToTags.set(parent, list);
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

  if (groupToTags.size === 0) {
    return undefined;
  }

  const allTagNames = new Set(tags.map((t) => t.name));

  return [...groupToTags.entries()].map(([name, childTags]) => {
    const finalTags: string[] = [];
    const seen = new Set<string>();

    // If a tag with the same name exists, include it first (common Redoc pattern).
    if (allTagNames.has(name)) {
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

