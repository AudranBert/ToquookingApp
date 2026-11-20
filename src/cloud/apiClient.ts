import { CLOUD_CONFIG } from "./config";
import { readCloudSettings, type CloudSettings } from "./settings";
import type { CloudHealth } from "./types";

export async function cloudRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; settings?: CloudSettings; timeout?: number } = {}
): Promise<T> {
  const settings = options.settings ?? readCloudSettings();
  if (!settings.apiUrl) throw new Error("Cloud not configured");
  const response = await fetch(`${settings.apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${settings.key}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeout ?? CLOUD_CONFIG.requestTimeoutMs),
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Cloud HTTP ${response.status}`);
  return response.json();
}

export async function checkCloudHealth(): Promise<CloudHealth> {
  const { apiUrl } = readCloudSettings();
  if (!apiUrl) return { server: false, database: false };
  try {
    const response = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(CLOUD_CONFIG.healthTimeoutMs),
    });
    const health = await response.json();
    return {
      server: response.ok && health.server === true,
      database: response.ok && health.database === true,
    };
  } catch {
    return { server: false, database: false };
  }
}
