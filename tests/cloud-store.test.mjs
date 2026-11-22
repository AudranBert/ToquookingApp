import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PostgresStore } from "../backend/postgres-store.mjs";

test("stale uploads and shares cannot overwrite a newer device or resurrect deleted recipes", async (t) => {
  const database = new PGlite();
  t.after(() => database.close());
  const query = async (sql, params) => {
    const result = await database.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const store = new PostgresStore({ query, connect: async () => ({ query, release() {} }) });
  await store.initialize();
  const newer = { id: "r1", name: "Nouvelle version", updatedAt: "2026-11-22T10:00:00Z" };
  const older = { ...newer, name: "Ancienne version", updatedAt: "2026-11-21T10:00:00Z" };
  const put = (recipe) =>
    store.sync("owner", [
      { operation: "put", recipeId: recipe.id, revision: crypto.randomUUID(), recipe },
    ]);
  await put(newer);
  await put(older);
  assert.equal((await store.recipes("owner"))[0].name, newer.name);
  const shareId = await store.share("owner", older);
  assert.equal((await store.sharedRecipe(shareId)).name, newer.name);
  await store.sync("owner", [
    { operation: "delete", recipeId: newer.id, revision: crypto.randomUUID() },
  ]);
  await put({ ...newer, updatedAt: "2026-11-23T00:00:00Z" });
  assert.deepEqual(await store.recipes("owner"), []);
});
