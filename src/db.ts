import Dexie, { type Table } from "dexie";
import type { Recipe } from "./types";

class ToqueDatabase extends Dexie {
  recipes!: Table<Recipe, string>;

  constructor() {
    super("toque-recipe-hub");
    this.version(1).stores({
      recipes: "id, name, updatedAt",
    });
  }
}

export const db = new ToqueDatabase();
