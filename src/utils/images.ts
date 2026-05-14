export function proxiedImageUrl(url?: string) {
  if (!url || !/^https?:\/\//.test(url)) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}
