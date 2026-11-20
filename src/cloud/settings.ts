import { CLOUD_CONFIG } from "./config";
export type CloudServerMode = "default" | "custom" | "disabled";
export type CloudSettings = {
  apiUrl: string;
  key: string;
  autoBackup: boolean;
  serverMode?: CloudServerMode;
};
const STORAGE_KEY = "toque.cloud.v1";
let defaultApiUrl = "";

export function readCloudSettings(): CloudSettings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      apiUrl: typeof value.apiUrl === "string" ? value.apiUrl : "",
      key: typeof value.key === "string" ? value.key : "",
      autoBackup: value.autoBackup === true,
      serverMode: ["default", "custom", "disabled"].includes(value.serverMode)
        ? value.serverMode
        : value.apiUrl
          ? "custom"
          : "default",
    };
  } catch {
    return { apiUrl: "", key: "", autoBackup: false, serverMode: "default" };
  }
}

export function cloudTarget(settings = readCloudSettings()) {
  return settings.apiUrl && settings.key ? `${settings.apiUrl}|${settings.key}` : "";
}

export function generateCloudKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function normalizeApiUrl(value: string) {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("HTTPS required");
  if (url.username || url.password || url.search || url.hash) throw new Error("Invalid server URL");
  return url.href.replace(/\/$/, "");
}

export function writeCloudSettings(settings: CloudSettings) {
  const next = { ...settings, apiUrl: normalizeApiUrl(settings.apiUrl), key: settings.key.trim() };
  if (!next.key) next.key = generateCloudKey();
  if (next.key && !/^[a-f0-9]{64}$/.test(next.key)) throw new Error("Invalid cloud key");
  if (!next.apiUrl) next.autoBackup = false;
  next.serverMode ??= next.apiUrl ? "custom" : "disabled";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("toque-cloud-settings"));
  return next;
}

/** Generate a private space once, even when cloud backups are disabled. */
export function initializeCloudSettings() {
  const settings = readCloudSettings();
  return settings.key ? settings : writeCloudSettings(settings);
}

export function getDefaultCloudServer() {
  const settings = readCloudSettings();
  return defaultApiUrl || (settings.serverMode === "default" ? settings.apiUrl : "");
}

// Deployment defaults contain only the public server address, never a private key.
export async function loadCloudDefaults() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}online-config.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(CLOUD_CONFIG.defaultsTimeoutMs),
    });
    if (!response.ok) return getDefaultCloudServer();
    const config = await response.json();
    const apiUrl = normalizeApiUrl(config.apiUrl || "");
    defaultApiUrl = apiUrl;
    const settings = initializeCloudSettings();
    if (settings.serverMode === "default" && settings.apiUrl !== apiUrl) {
      writeCloudSettings({ ...settings, apiUrl });
    }
  } catch {
    // Cloud configuration is optional; local functionality never depends on it.
  }
  return getDefaultCloudServer();
}
