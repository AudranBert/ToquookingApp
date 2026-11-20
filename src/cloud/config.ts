/** Browser-side timing and batching. Server validation remains authoritative. */
export const CLOUD_CONFIG = {
  requestTimeoutMs: 90_000,
  healthTimeoutMs: 9_000,
  defaultsTimeoutMs: 10_000,
  healthIntervalMs: 10_000,
  retryIntervalMs: 30_000,
  uploadDebounceMs: 750,
  maxBatchRecipes: 25,
  maxBatchBytes: 16 * 1024 * 1024,
} as const;
