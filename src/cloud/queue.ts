import { CLOUD_CONFIG } from "./config";
import { db } from "../db";
import { cloudRequest } from "./apiClient";
import { cloudTarget, readCloudSettings } from "./settings";
import type { CloudMutation } from "./types";
import { toCloudRecipe } from "./recipePayload";

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
      if (
        batch.length &&
        (bytes + size > CLOUD_CONFIG.maxBatchBytes || batch.length >= CLOUD_CONFIG.maxBatchRecipes)
      )
        break;
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
