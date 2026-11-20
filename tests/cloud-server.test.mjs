import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { createServer } from "../backend/server.mjs";
import { PostgresStore } from "../backend/postgres-store.mjs";

function sampleRecipe(id = "recipe-1", name = "Soupe") {
  return {
    id,
    name,
    tags: ["Plat"],
    ingredients: [{ id: "ingredient-1", name: "Carotte", quantity: "2" }],
    instructions: ["Cuire."],
    imageUrl: "data:image/png;base64,YQ==",
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
  };
}

test("cloud API: isolation, persistent storage, public links, retries and trash", async (t) => {
  const embedded = process.env.TEST_DATABASE_URL ? undefined : new PGlite();
  const query = async (sql, params) => {
    const result = await embedded.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const pool = embedded
    ? {
        query,
        connect: async () => ({ query, release() {} }),
        end: () => embedded.close(),
      }
    : new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const store = new PostgresStore(pool);
  await store.initialize();
  const server = createServer({ store, origins: ["https://app.example"] });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const key = "a".repeat(64);
  async function request(path, { method = "GET", body, token = key, origin } = {}) {
    return fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(origin ? { Origin: origin } : {}),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  assert.deepEqual(await (await request("/health")).json(), { server: true, database: true });
  assert.equal((await request("/recipes", { token: null })).status, 401);
  assert.equal((await request("/recipes", { origin: "https://evil.example" })).status, 403);
  assert.equal(
    (await request("/recipes", { origin: "https://app.example" })).headers.get(
      "access-control-allow-origin"
    ),
    "https://app.example"
  );
  const recipe = sampleRecipe(`recipe-${Date.now()}`);
  const revision = () => crypto.randomUUID();
  const first = { operation: "put", recipeId: recipe.id, revision: revision(), recipe };
  const sync = (mutations) => request("/sync", { method: "POST", body: { mutations } });
  assert.equal((await sync([first])).status, 200);
  assert.equal((await (await request("/recipes")).json()).recipes[0].imageUrl, recipe.imageUrl);
  assert.deepEqual(
    (await (await request("/recipes", { token: "b".repeat(64) })).json()).recipes,
    []
  );
  const freshStore = new PostgresStore(pool);
  // New store instances use the database, never process memory.
  const { createHash } = await import("node:crypto");
  const owner = createHash("sha256").update(key).digest("hex");
  assert.equal((await freshStore.recipes(owner))[0].id, recipe.id);
  const link = await (await request("/shares", { method: "POST", body: { recipe } })).json();
  assert.match(link.shareId, /^[a-f0-9-]{36}$/);
  const shared = await (await request(`/shares/${link.shareId}`, { token: null })).json();
  assert.equal(shared.recipe.name, "Soupe");
  assert.equal(
    (await (await request("/shares", { method: "POST", body: { recipe } })).json()).shareId,
    link.shareId
  );
  const edited = { ...recipe, name: "Soupe modifiÃ©e" };
  await sync([{ ...first, revision: revision(), recipe: edited }]);
  await sync([first]); // retry of an older request cannot undo the newer edit
  assert.equal(
    (await (await request(`/shares/${link.shareId}`, { token: null })).json()).recipe.name,
    edited.name
  );
  const bad = await sync([
    { ...first, revision: revision(), recipe: { ...recipe, instructions: "invalid" } },
  ]);
  assert.equal(bad.status, 400);
  const deletion = { operation: "delete", recipeId: recipe.id, revision: revision() };
  await sync([deletion]);
  const trashBefore = await pool.query(
    "SELECT payload, deleted_at FROM toque_recipes WHERE owner = $1 AND id = $2",
    [owner, recipe.id]
  );
  assert.equal(trashBefore.rows[0].payload.name, edited.name);
  assert.deepEqual((await (await request("/recipes")).json()).recipes, []);
  assert.equal((await request(`/shares/${link.shareId}`, { token: null })).status, 404);
  await sync([{ ...first, revision: revision() }]); // stale device cannot resurrect trash
  assert.deepEqual(await freshStore.recipes(owner), []);
  await sync([deletion]);
  const trashAfter = await pool.query(
    "SELECT deleted_at FROM toque_recipes WHERE owner = $1 AND id = $2",
    [owner, recipe.id]
  );
  assert.equal(+trashBefore.rows[0].deleted_at, +trashAfter.rows[0].deleted_at);
  await pool.query("UPDATE toque_recipes SET deleted_at = $1 WHERE owner = $2 AND id = $3", [
    new Date(Date.now() - 8 * 86400000),
    owner,
    recipe.id,
  ]);
  await store.cleanup();
  const purged = await pool.query(
    "SELECT payload FROM toque_recipes WHERE owner = $1 AND id = $2",
    [owner, recipe.id]
  );
  assert.equal(purged.rows[0].payload, null);
});

test("optional database: server is available while cloud operations are disabled", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(base + "/health")).json(), { server: true, database: false });
  assert.equal((await fetch(base + "/recipes")).status, 503);
});
