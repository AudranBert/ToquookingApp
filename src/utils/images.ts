const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export function proxiedImageUrl(url?: string) {
  if (!url || !/^https?:\/\//.test(url)) return url;
  return `${API_BASE_URL || ""}/api/image?url=${encodeURIComponent(url)}`;
}
