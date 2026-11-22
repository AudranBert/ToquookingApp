export function absolutizeUrl(value: string | undefined, baseUrl: string) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) {
    try {
      const { protocol } = new URL(baseUrl);
      return `${protocol}${trimmed}`;
    } catch {
      return `https:${trimmed}`;
    }
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}
