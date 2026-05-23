import Dexie, { type Table } from "dexie";
import type { Recipe, RecipeTag } from "./types";

const DB_NAME = "toque-recipe-hub-v2";
const LEGACY_DB_NAMES = ["toque-recipe-hub"];

class ToqueDatabase extends Dexie {
  recipes!: Table<Recipe, string>;
  tags!: Table<RecipeTag, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      recipes: "id, name, updatedAt",
      tags: "&id, &name, category, updatedAt",
    });
  }
}

async function deleteLegacyDatabases() {
  for (const legacyName of LEGACY_DB_NAMES) {
    try {
      await Dexie.delete(legacyName);
    } catch {
      // Ignore failures, app can continue with the new database name.
    }
  }
}

void deleteLegacyDatabases();

export const db = new ToqueDatabase();
