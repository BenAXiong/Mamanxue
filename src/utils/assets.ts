const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

function stripLeadingSlash(value: string): string {
  return value.startsWith("/") ? value.slice(1) : value;
}

export function resolvePublicAssetPath(path: string): string {
  if (!path) {
    return path;
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL ?? "/";
  const normalisedBase = base.endsWith("/") ? base : `${base}/`;
  const normalisedPath = stripLeadingSlash(path);

  return `${normalisedBase}${normalisedPath}`;
}
