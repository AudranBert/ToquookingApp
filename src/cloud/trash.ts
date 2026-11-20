import { db } from "../db";
import { cloudRequest } from "./client";
import { cloudTarget, type CloudSettings } from "./settings";
import { flushCloudQueue } from "./sync";
import { parseCloudRecipe } from "./validation";
import { preserveLocalImages } from "./recipePayload";
import type { CloudTrashEntry } from "./types";

export async function listCloudTrash(settings: CloudSettings) {
  const { recipes } = await cloudRequest<{ recipes: CloudTrashEntry[] }>("/trash", { settings });
  if (
    !Array.isArray(recipes) ||
    !recipes.every(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(entry.id) &&
        typeof entry.name === "string" &&
        typeof entry.deletedAt === "string" &&
        Number.isFinite(Date.parse(entry.deletedAt)) &&
        typeof entry.expiresAt === "string" &&
        Number.isFinite(Date.parse(entry.expiresAt))
    )
  )
    throw new Error("Invalid cloud trash");
  return recipes;
}

export async function restoreCloudRecipe(id: string, settings: CloudSettings) {
  const target = cloudTarget(settings);
  if (!target || cloudTarget() !== target) throw new Error("Cloud settings changed");
  // Finish previous deletes before restoring; their retries are idempotent on the server.
  await flushCloudQueue();
  if (cloudTarget() !== target) throw new Error("Cloud settings changed");
  const localBefore = await db.recipes.get(id);
  const { recipe: raw } = await cloudRequest<{ recipe: unknown }>(
    `/trash/${encodeURIComponent(id)}/restore`,
    { method: "POST", settings }
  );
  const recipe = parseCloudRecipe(raw);
  if (recipe.id !== id || cloudTarget() !== target) throw new Error("Cloud settings changed");
  let appliedLocally = false;
  await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
    if (cloudTarget() !== target) throw new Error("Cloud settings changed");
    const local = await db.recipes.get(id);
    const pending = await db.cloudQueue.get([target, id]);
    // Preserve edits/deletes made while the restoration request was in flight.
    if (!pending && JSON.stringify(local) === JSON.stringify(localBefore)) {
      await db.recipes.put(preserveLocalImages(recipe, local));
      appliedLocally = true;
    }
  });
  return appliedLocally;
}

export async function purgeCloudRecipe(id: string, settings: CloudSettings) {
  await cloudRequest(`/trash/${encodeURIComponent(id)}/purge`, { method: "POST", settings });
}

export async function emptyCloudTrash(settings: CloudSettings) {
  await cloudRequest("/trash/empty", { method: "POST", settings });
}
