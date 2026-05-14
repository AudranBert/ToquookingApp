import { normalizeText } from "../seasonal";
import type { BackupFile, Recipe } from "../types";
import { createId } from "./id";

export function downloadRecipesBackup(recipes: Recipe[], tags: string[] = []) {
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags,
    recipes,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `toque-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadSingleRecipeBackup(recipe: Recipe) {
  downloadBlob(singleRecipeBackupBlob(recipe), recipeBackupFileName(recipe));
}

export async function shareSingleRecipeBackup(recipe: Recipe) {
  const filename = recipeBackupFileName(recipe);
  const file = new File([singleRecipeBackupBlob(recipe)], filename, { type: "application/json" });
  const shareData: ShareData = {
    title: recipe.name,
    text: `Recette Toque: ${recipe.name}`,
    files: [file],
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return "shared";
  }

  downloadSingleRecipeBackup(recipe);
  return "downloaded";
}

function singleRecipeBackupBlob(recipe: Recipe) {
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: recipe.tags,
    recipes: [recipe],
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function parseBackupFile(file: File, existingRecipes: Recipe[]) {
  const backup = JSON.parse(await file.text()) as BackupFile;
  if (backup.version !== 1 || !Array.isArray(backup.recipes)) {
    throw new Error("Invalid backup format");
  }

  const existingKeys = new Set(existingRecipes.map((recipe) => normalizeText(`${recipe.name} ${recipe.sourceUrl ?? ""}`)));

  const recipes = backup.recipes.map((recipe) => {
    const key = normalizeText(`${recipe.name} ${recipe.sourceUrl ?? ""}`);
    return existingKeys.has(key)
      ? { ...recipe, id: createId(), name: `${recipe.name} (import)` }
      : recipe;
  });

  return {
    recipes,
    tags: Array.isArray(backup.tags) ? backup.tags.map((tag) => tag.trim()).filter(Boolean) : [],
  };
}

function recipeBackupFileName(recipe: Recipe) {
  const slug = recipe.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `toque-recette-${slug || "recette"}.json`;
}
