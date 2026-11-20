import { CLOUD_CONFIG } from "./config.mjs";
import pg from "pg";
import { createServer } from "./server.mjs";
import { PostgresStore } from "./postgres-store.mjs";

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: CLOUD_CONFIG.databasePoolSize,
      connectionTimeoutMillis: CLOUD_CONFIG.databaseConnectionTimeoutMs,
      statement_timeout: CLOUD_CONFIG.databaseStatementTimeoutMs,
    })
  : undefined;
pool?.on("error", (error) => console.error("Cloud pool error", error.code ?? error.name));
const store = pool ? new PostgresStore(pool) : undefined;
// Serve health even if the database is temporarily down; initialize on retry.
let ready = false;
async function maintain() {
  try {
    if (store) {
      if (!ready) {
        await store.initialize();
        ready = true;
      }
      await store.cleanup();
    }
  } catch (error) {
    console.error("Cloud maintenance failed", error.code ?? error.name);
  }
}
await maintain();
const maintenance = setInterval(maintain, CLOUD_CONFIG.maintenanceIntervalMs);
maintenance.unref();
const server = createServer({
  store,
  origins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
});
server.requestTimeout = CLOUD_CONFIG.requestTimeoutMs;
server.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log("Toquooking cloud server ready")
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(maintenance);
    server.close(async () => {
      await pool?.end();
      process.exit(0);
    });
  });
