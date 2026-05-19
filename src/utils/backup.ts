import { normalizeText } from "../seasonal";
import type { BackupFile, Recipe } from "../types";
import { createId } from "./id";

export function downloadRecipesBackup(recipes: Recipe[], tags: string[] = []) {
  downloadBlob(recipesBackupBlob(recipes, tags), recipesBackupFileName());
}

export async function shareRecipesBackup(recipes: Recipe[], tags: string[] = []) {
  const filename = recipesBackupFileName();
  const blob = recipesBackupBlob(recipes, tags);
  const jsonFile = new File([blob], filename, { type: "application/json" });
  if (await tryShare({ files: [jsonFile] })) {
    return "shared";
  }

  const plainTextFile = new File([blob], filename, { type: "text/plain" });
  if (await tryShare({ files: [plainTextFile] })) {
    return "shared";
  }

  downloadRecipesBackup(recipes, tags);
  return "downloaded";
}

function recipesBackupBlob(recipes: Recipe[], tags: string[] = []) {
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags,
    recipes,
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

export function downloadSingleRecipeBackup(recipe: Recipe) {
  downloadBlob(singleRecipeBackupBlob(recipe), recipeBackupFileName(recipe));
}

export async function shareSingleRecipeBackup(recipe: Recipe) {
  const filename = recipeBackupFileName(recipe);
  const blob = singleRecipeBackupBlob(recipe);
  const jsonFile = new File([blob], filename, { type: "application/json" });
  if (await tryShare({ files: [jsonFile] })) {
    return "shared";
  }

  const plainTextFile = new File([blob], filename, { type: "text/plain" });
  if (await tryShare({ files: [plainTextFile] })) {
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

function recipesBackupFileName() {
  return `toque-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
}

async function tryShare(shareData: ShareData) {
  if (!navigator.share) return false;

  if (navigator.canShare && !navigator.canShare(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return false;
  }
}
