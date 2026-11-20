import { db } from "../db";
import type { Recipe } from "../types";
import { parseCloudRecipe } from "./validation";
import { createId } from "../utils/id";
import { cloudRequest } from "./client";
import { cloudTarget, readCloudSettings } from "./settings";
import type { CloudMutation } from "./types";
import { preserveLocalImages, toCloudRecipe } from "./recipePayload";

let running: Promise<void> | undefined;

/** Acknowledge only the exact revisions sent; edits made during upload stay queued. */
async function acknowledge(batch: CloudMutation[]) {
  await db.transaction("rw", db.cloudQueue, async () => {
    for (const mutation of batch) {
      const key: [string, string] = [mutation.target, mutation.recipeId];
      if ((await db.cloudQueue.get(key))?.revision === mutation.revision)
        await db.cloudQueue.delete(key);
    }
  });
}

async function drainQueue() {
  const settings = readCloudSettings();
  const target = cloudTarget(settings);
  if (!target) return;
  while (cloudTarget() === target) {
    const queued = await db.cloudQueue.where("target").equals(target).toArray();
    // Turning automatic backup off pauses uploads, but never pauses deletions.
    const eligible = queued
      .filter(
        (item) => readCloudSettings().autoBackup || item.operation === "delete" || item.manual
      )
      .map((item) => (item.recipe ? { ...item, recipe: toCloudRecipe(item.recipe) } : item));
    if (!eligible.length) return;
    const batch: CloudMutation[] = [];
    let bytes = 0;
    for (const item of eligible) {
      const size = new TextEncoder().encode(JSON.stringify(item.recipe ?? {})).length;
      if (batch.length && (bytes + size > 16 * 1024 * 1024 || batch.length >= 25)) break;
      bytes += size;
      batch.push(item);
    }
    await cloudRequest("/sync", {
      method: "POST",
      settings,
      body: {
        mutations: batch.map(({ recipeId, revision, operation, recipe }) => ({
          recipeId,
          revision,
          operation,
          recipe,
        })),
      },
    });
    await acknowledge(batch);
  }
}

export function flushCloudQueue(): Promise<void> {
  if (!running) {
    running = (async () => {
      if (typeof navigator !== "undefined" && navigator.locks) {
        await navigator.locks.request("toque-cloud-sync", () => drainQueue());
      } else {
        await drainQueue();
      }
    })().finally(() => {
      running = undefined;
    });
  }
  return running;
}

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
