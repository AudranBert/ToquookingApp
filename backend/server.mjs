import { CLOUD_CONFIG } from "./config.mjs";
import http from "node:http";
import { createHash } from "node:crypto";
import { HttpError, validateMutations, validateRecipe } from "./validation.mjs";

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > CLOUD_CONFIG.maxRequestBytes)
      throw new HttpError(413, `Request exceeds ${CLOUD_CONFIG.maxRequestBytes} bytes`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function createServer({
  store,
  origins = [],
  rateLimit = CLOUD_CONFIG.requestsPerMinute,
} = {}) {
  const requests = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status, body) => {
      res.writeHead(status);
      res.end(JSON.stringify(body));
    };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new HttpError(403, "Origin rejected");
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (req.method === "OPTIONS") return reply(204, null);
      const now = Date.now();
      for (const [key, value] of requests)
        if (now - value.start > CLOUD_CONFIG.rateWindowMs) requests.delete(key);
      const ip = req.socket.remoteAddress;
      const rate = requests.get(ip) ?? { start: now, count: 0 };
      if (!requests.has(ip) && requests.size >= CLOUD_CONFIG.maxTrackedAddresses)
        throw new HttpError(429, "Server busy");
      requests.set(ip, rate);
      if (++rate.count > rateLimit) throw new HttpError(429, "Too many requests");
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/health") {
        let database = false;
        try {
          if (store) {
            await store.health();
            database = true;
          }
        } catch {
          /* Report each connection separately. */
        }
        return reply(200, { server: true, database });
      }
      if (!store) throw new HttpError(503, "Database not configured");
      const shared = url.pathname.match(/^\/shares\/([a-f0-9-]{36})$/);
      if (req.method === "GET" && shared)
        return reply(200, { recipe: await store.sharedRecipe(shared[1]) });
      const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!token) throw new HttpError(401, "Private cloud key required");
      const owner = createHash("sha256").update(token).digest("hex");
      if (req.method === "GET" && url.pathname === "/recipes")
        return reply(200, { recipes: await store.recipes(owner) });
      if (req.method === "GET" && url.pathname === "/trash")
        return reply(200, { recipes: await store.trash(owner) });
      if (req.method === "POST" && url.pathname === "/trash/empty")
        return reply(200, { count: await store.emptyTrash(owner) });
      const trashAction = url.pathname.match(/^\/trash\/([a-zA-Z0-9_-]{1,128})\/(restore|purge)$/);
      if (req.method === "POST" && trashAction) {
        const [, id, action] = trashAction;
        if (action === "restore") return reply(200, { recipe: await store.restore(owner, id) });
        await store.purge(owner, id);
        return reply(200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/sync") {
        const mutations = validateMutations(await readJson(req));
        await store.sync(owner, mutations);
        return reply(200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/shares") {
        const { recipe } = await readJson(req);
        return reply(201, { shareId: await store.share(owner, validateRecipe(recipe)) });
      }
      throw new HttpError(404, "Unknown endpoint");
    } catch (error) {
      if (!error.status) console.error("Cloud operation failed", error.code ?? error.name);
      reply(error.status ?? 503, {
        error: error.status ? error.message : "Cloud temporarily unavailable",
      });
    }
  });
}
