export function proxiedImageUrl(url?: string) {
  if (!url || !/^https?:\/\//.test(url)) return url;

  const endpoint = `${import.meta.env.BASE_URL}api/image?url=${encodeURIComponent(url)}`;
  const isLocalHost = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
  return isLocalHost ? endpoint : url;
}
