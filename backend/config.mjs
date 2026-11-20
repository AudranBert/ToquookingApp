/** Server limits and maintenance settings. No browser code or credentials here. */
export const CLOUD_CONFIG = {
  maxRequestBytes: 24 * 1024 * 1024,
  maxRecipeBytes: 12 * 1024 * 1024,
  maxImageCharacters: 8 * 1024 * 1024,
  maxTextCharacters: 20_000,
  maxBatchRecipes: 25,
  requestsPerMinute: 120,
  rateWindowMs: 60_000,
  maxTrackedAddresses: 10_000,
  trashRetentionDays: 7,
  maintenanceIntervalMs: 60_000,
  requestTimeoutMs: 120_000,
  databasePoolSize: 5,
  databaseConnectionTimeoutMs: 10_000,
  databaseStatementTimeoutMs: 15_000,
};
