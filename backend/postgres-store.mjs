import { randomUUID } from "node:crypto";
import { HttpError } from "./validation.mjs";

export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }

  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS toque_recipes (
      owner text NOT NULL, id text NOT NULL, payload jsonb,
      deleted_at timestamptz, PRIMARY KEY (owner, id)
    )`);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS toque_recipes_trash ON toque_recipes (deleted_at)`
    );
    await this.pool.query(`CREATE TABLE IF NOT EXISTS toque_mutations (
      owner text NOT NULL, revision text NOT NULL, PRIMARY KEY (owner, revision)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS toque_shares (
      id text PRIMARY KEY, owner text NOT NULL, recipe_id text NOT NULL,
      UNIQUE (owner, recipe_id),
      FOREIGN KEY (owner, recipe_id) REFERENCES toque_recipes(owner, id) ON DELETE CASCADE
    )`);
  }

  async health() {
    await this.pool.query("SELECT 1");
  }

  async cleanup() {
    // Keep a compact tombstone to prevent another device resurrecting a deleted
    // recipe. The recipe content itself is permanently removed after seven days.
    await this.pool.query(
      "DELETE FROM toque_shares WHERE (owner, recipe_id) IN (SELECT owner, id FROM toque_recipes WHERE deleted_at <= now() - interval '7 days')"
    );
    await this.pool.query(
      "UPDATE toque_recipes SET payload = NULL WHERE deleted_at <= now() - interval '7 days' AND payload IS NOT NULL"
    );
  }

  async sync(owner, mutations) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const mutation of mutations) {
        // Retried requests must never roll back a newer edit or reset trash age.
        const receipt = await client.query(
          "INSERT INTO toque_mutations(owner, revision) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING revision",
          [owner, mutation.revision]
        );
        if (!receipt.rowCount) continue;
        if (mutation.operation === "delete") {
          await client.query(
            `INSERT INTO toque_recipes(owner, id, payload, deleted_at) VALUES ($1, $2, NULL, now())
            ON CONFLICT (owner, id) DO UPDATE SET deleted_at = COALESCE(toque_recipes.deleted_at, now())`,
            [owner, mutation.recipeId]
          );
        } else {
          await client.query(
            `INSERT INTO toque_recipes(owner, id, payload) VALUES ($1, $2, $3)
            ON CONFLICT (owner, id) DO UPDATE SET payload = EXCLUDED.payload WHERE toque_recipes.deleted_at IS NULL`,
            [owner, mutation.recipeId, JSON.stringify(mutation.recipe)]
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recipes(owner) {
    const { rows } = await this.pool.query(
      "SELECT payload FROM toque_recipes WHERE owner = $1 AND deleted_at IS NULL ORDER BY id",
      [owner]
    );
    return rows.map((row) => row.payload);
  }

  async transaction(action) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async trash(owner) {
    const { rows } = await this.pool.query(
      `SELECT id, payload->>'name' AS name, deleted_at
      FROM toque_recipes WHERE owner = $1 AND payload IS NOT NULL
      AND deleted_at > now() - interval '7 days' ORDER BY deleted_at DESC, id`,
      [owner]
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      deletedAt: new Date(row.deleted_at).toISOString(),
      expiresAt: new Date(new Date(row.deleted_at).getTime() + 7 * 86400000).toISOString(),
    }));
  }

  async restore(owner, id) {
    return this.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT payload, deleted_at,
        deleted_at > now() - interval '7 days' AS restorable
        FROM toque_recipes WHERE owner = $1 AND id = $2 FOR UPDATE`,
        [owner, id]
      );
      const row = rows[0];
      if (!row?.payload || (row.deleted_at && !row.restorable))
        throw new HttpError(410, "Recipe expired or permanently deleted");
      // Retrying after a lost response is safe and keeps the same restored version.
      if (!row.deleted_at) return row.payload;
      const recipe = { ...row.payload, updatedAt: new Date().toISOString() };
      await client.query(
        "UPDATE toque_recipes SET payload = $3, deleted_at = NULL WHERE owner = $1 AND id = $2",
        [owner, id, JSON.stringify(recipe)]
      );
      return recipe;
    });
  }

  async purge(owner, id) {
    return this.transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT deleted_at FROM toque_recipes WHERE owner = $1 AND id = $2 FOR UPDATE",
        [owner, id]
      );
      if (!rows[0]?.deleted_at) throw new HttpError(404, "Recipe not in trash");
      await client.query("DELETE FROM toque_shares WHERE owner = $1 AND recipe_id = $2", [
        owner,
        id,
      ]);
      // Retain the tombstone and mutation receipts to block stale-device uploads.
      await client.query("UPDATE toque_recipes SET payload = NULL WHERE owner = $1 AND id = $2", [
        owner,
        id,
      ]);
    });
  }

  async emptyTrash(owner) {
    return this.transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT id FROM toque_recipes WHERE owner = $1 AND deleted_at IS NOT NULL AND payload IS NOT NULL ORDER BY id FOR UPDATE",
        [owner]
      );
      if (!rows.length) return 0;
      const ids = rows.map((row) => row.id);
      await client.query(
        "DELETE FROM toque_shares WHERE owner = $1 AND recipe_id = ANY($2::text[])",
        [owner, ids]
      );
      await client.query(
        "UPDATE toque_recipes SET payload = NULL WHERE owner = $1 AND id = ANY($2::text[])",
        [owner, ids]
      );
      return rows.length;
    });
  }

  async share(owner, recipe) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO toque_recipes(owner, id, payload) VALUES ($1, $2, $3)
        ON CONFLICT (owner, id) DO UPDATE SET payload = EXCLUDED.payload WHERE toque_recipes.deleted_at IS NULL RETURNING id`,
        [owner, recipe.id, JSON.stringify(recipe)]
      );
      if (!result.rowCount) throw new HttpError(410, "Recipe in trash");
      const { rows } = await client.query(
        `INSERT INTO toque_shares(id, owner, recipe_id) VALUES ($1, $2, $3)
        ON CONFLICT (owner, recipe_id) DO UPDATE SET recipe_id = EXCLUDED.recipe_id RETURNING id`,
        [randomUUID(), owner, recipe.id]
      );
      await client.query("COMMIT");
      return rows[0].id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async sharedRecipe(id) {
    const { rows } = await this.pool.query(
      `SELECT r.payload FROM toque_shares s JOIN toque_recipes r ON r.owner = s.owner AND r.id = s.recipe_id
      WHERE s.id = $1 AND r.deleted_at IS NULL`,
      [id]
    );
    if (!rows.length) throw new HttpError(404, "Share unavailable");
    return rows[0].payload;
  }
}
