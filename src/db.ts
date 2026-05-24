import Dexie, { type Table } from "dexie";
import type { Recipe, RecipeTag } from "./types";

const DB_NAME = "toque-recipe-hub-v2";

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

export const db = new ToqueDatabase();
