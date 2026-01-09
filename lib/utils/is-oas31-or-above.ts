export function isOas31OrAbove(openapi?: string): boolean {
  const [majorStr, minorStr] = (openapi || '').split('.');
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    return false;
  }
  return major > 3 || (major === 3 && minor >= 1);
}

