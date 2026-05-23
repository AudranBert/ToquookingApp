function absolutize(url: string, baseUrl?: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) {
    if (!baseUrl) return `https:${url}`;
    try {
      const { protocol } = new URL(baseUrl);
      return `${protocol}${url}`;
    } catch {
      return `https:${url}`;
    }
  }
  if (!baseUrl) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

export function proxiedImageUrl(url?: string, baseUrl?: string) {
  if (!url) return url;
  const absolute = absolutize(url, baseUrl);
  if (!/^https?:\/\//.test(absolute)) return absolute;

  const endpoint = `${import.meta.env.BASE_URL}api/image?url=${encodeURIComponent(absolute)}`;
  const isLocalHost = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
  return isLocalHost ? endpoint : absolute;
}

export function shouldUseImageCrossOrigin(url?: string, baseUrl?: string) {
  if (!url) return false;
  const absolute = absolutize(url, baseUrl);
  if (!/^https?:\/\//.test(absolute)) return false;
  return /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
}
