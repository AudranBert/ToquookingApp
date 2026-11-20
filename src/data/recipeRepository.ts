import { db } from "../db";
import type { Recipe } from "../types";
import { createId } from "../utils/id";
import { cloudTarget, readCloudSettings } from "../cloud/settings";
import { toCloudRecipe } from "../cloud/recipePayload";

/** Local writes and their latest cloud mutation commit atomically. */
export async function putRecipes(recipes: Recipe[]) {
  const settings = readCloudSettings();
  const target = cloudTarget(settings);
  await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
    await db.recipes.bulkPut(recipes);
    if (target && settings.autoBackup) {
      await db.cloudQueue.bulkPut(
        recipes.map((recipe) => ({
          target,
          recipeId: recipe.id,
          revision: createId(),
          operation: "put" as const,
          recipe: toCloudRecipe(recipe),
        }))
      );
    }
  });
}

export async function putRecipe(recipe: Recipe) {
  await putRecipes([recipe]);
  return recipe.id;
}

export async function deleteRecipe(id: string) {
  const target = cloudTarget();
  await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
    await db.recipes.delete(id);
    // Deletion propagates even with automatic backup turned off.
    if (target)
      await db.cloudQueue.put({ target, recipeId: id, revision: createId(), operation: "delete" });
  });
}
