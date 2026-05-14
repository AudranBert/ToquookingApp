import Dexie, { type Table } from "dexie";
import type { Recipe, RecipeTag } from "./types";

class ToqueDatabase extends Dexie {
  recipes!: Table<Recipe, string>;
  tags!: Table<RecipeTag, string>;

  constructor() {
    super("toque-recipe-hub");
    this.version(1).stores({
      recipes: "id, name, updatedAt",
    });
    this.version(2).stores({
      recipes: "id, name, updatedAt",
      tags: "name, updatedAt",
    });
  }
}

export const db = new ToqueDatabase();
