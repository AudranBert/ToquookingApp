import { db } from "../db";
import type { Recipe } from "../types";
import { createId } from "../utils/id";
import { cloudRequest } from "./apiClient";
import { cloudTarget, readCloudSettings } from "./settings";
import { parseCloudRecipe } from "./validation";
import { preserveLocalImages, toCloudRecipe } from "./recipePayload";
import { flushCloudQueue } from "./queue";

/** Manual upload also updates existing recipes, preserving pending deletions. */
export async function uploadLocalRecipes() {
  const target = cloudTarget();
  if (!target) throw new Error("Cloud not configured");
  await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
    for (const recipe of await db.recipes.toArray()) {
      const pending = await db.cloudQueue.get([target, recipe.id]);
      if (pending?.operation !== "delete")
        await db.cloudQueue.put({
          target,
          recipeId: recipe.id,
          revision: createId(),
          operation: "put",
          recipe: toCloudRecipe(recipe),
          manual: true,
        });
    }
  });
  await flushCloudQueue();
  // A previous flush may have been about to finish as this upload was queued.
  await flushCloudQueue();
}

/** Merge by ID. Pending local edits/deletions and newer local recipes always win. */
export async function downloadCloudRecipes() {
  const settings = readCloudSettings();
  const target = cloudTarget(settings);
  const { recipes } = await cloudRequest<{ recipes: Recipe[] }>("/recipes", { settings });
  if (cloudTarget() !== target) throw new Error("Cloud settings changed");
  let count = 0;
  await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
    for (const raw of recipes) {
      const recipe = parseCloudRecipe(raw);
      const local = await db.recipes.get(recipe.id);
      const pending = await db.cloudQueue.get([target, recipe.id]);
      if (!pending && (!local || Date.parse(recipe.updatedAt) > Date.parse(local.updatedAt))) {
        await db.recipes.put(preserveLocalImages(recipe, local));
        count++;
      }
    }
  });
  return count;
}
