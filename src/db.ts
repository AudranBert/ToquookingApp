import Dexie, { type Table } from "dexie";
import { DEFAULT_RECIPE_TOOLS } from "./constants";
import { t } from "./i18n";
import type { Recipe, RecipeTag } from "./types";
import { createId } from "./utils/id";
import { nowIso } from "./utils/recipes";
import { formatTagName } from "./utils/tags";
import { normalizeText } from "./utils/text";

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
    this.version(2)
      .stores({
        recipes: "id, name, updatedAt",
        tags: "&id, &name, category, updatedAt",
      })
      .upgrade(async (tx) => {
        const tagsTable = tx.table<RecipeTag, string>("tags");
        const existing = await tagsTable.toArray();
        const byName = new Map(existing.map((tag) => [normalizeText(tag.name), tag]));
        const toolsCategory = t("manage.category.tools");
        const now = nowIso();
        const toUpsert: RecipeTag[] = [];

        for (const name of DEFAULT_RECIPE_TOOLS) {
          const current = byName.get(normalizeText(name));
          if (!current) {
            toUpsert.push({
              id: createId(),
              name,
              category: toolsCategory,
              createdAt: now,
              updatedAt: now,
            });
            continue;
          }
          if (current.category !== toolsCategory) {
            toUpsert.push({ ...current, category: toolsCategory, updatedAt: now });
          }
        }

        if (toUpsert.length > 0) await tagsTable.bulkPut(toUpsert);
      });
    this.version(3)
      .stores({
        recipes: "id, name, updatedAt",
        tags: "&id, &name, category, updatedAt",
      })
      .upgrade(async (tx) => {
        const tagsTable = tx.table<RecipeTag, string>("tags");
        const existing = await tagsTable.toArray();
        const byName = new Map(existing.map((tag) => [normalizeText(tag.name), tag]));
        const toolsCategory = t("manage.category.tools");
        const now = nowIso();
        const toUpsert: RecipeTag[] = [];

        for (const name of DEFAULT_RECIPE_TOOLS) {
          const current = byName.get(normalizeText(name));
          if (!current) {
            toUpsert.push({
              id: createId(),
              name,
              category: toolsCategory,
              createdAt: now,
              updatedAt: now,
            });
            continue;
          }
          if (current.category !== toolsCategory) {
            toUpsert.push({ ...current, category: toolsCategory, updatedAt: now });
          }
        }

        if (toUpsert.length > 0) await tagsTable.bulkPut(toUpsert);
      });
    this.version(4)
      .stores({
        recipes: "id, name, updatedAt",
        tags: "&id, &name, category, updatedAt",
      })
      .upgrade(async (tx) => {
        const tagsTable = tx.table<RecipeTag, string>("tags");
        const existing = await tagsTable.toArray();
        const toolsCategory = t("manage.category.tools");
        const now = nowIso();
        const toUpsert: RecipeTag[] = [];

        for (const tag of existing) {
          const repairedName = formatTagName(tag.name);
          const isDefaultTool = DEFAULT_RECIPE_TOOLS.some((tool) => normalizeText(tool) === normalizeText(repairedName));
          const repairedCategory = isDefaultTool ? toolsCategory : tag.category;
          if (repairedName !== tag.name || repairedCategory !== tag.category) {
            toUpsert.push({ ...tag, name: repairedName, category: repairedCategory, updatedAt: now });
          }
        }

        if (toUpsert.length > 0) await tagsTable.bulkPut(toUpsert);
      });
  }
}

export const db = new ToqueDatabase();
