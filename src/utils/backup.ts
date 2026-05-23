import { normalizeText } from "../seasonal";
import type { BackupFile, Recipe } from "../types";
import { createId } from "./id";

type RecipeDatabaseJson = {
  version: 1;
  exportedAt: string;
  tags: string[];
  ingredients: string[];
  recipeNames: string[];
};

export function downloadRecipesBackup(recipes: Recipe[], tags: string[] = []) {
  downloadBlob(recipesBackupBlob(recipes, tags), recipesBackupFileName());
}

export function downloadRecipeImportExample() {
  downloadBlob(recipeImportExampleBlob(), "toque-exemple-import.json");
}

export function downloadRecipeDatabaseJson(recipes: Recipe[], tags: string[] = []) {
  downloadBlob(recipeDatabaseBlob(recipes, tags), "toque-base-recettes.json");
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
  const globalTags = normalizeTagList([...tags, ...recipes.flatMap((recipe) => recipe.tags)]);
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: globalTags,
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
    tags: normalizeTagList(recipe.tags),
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
  const backup = JSON.parse(await file.text()) as Partial<BackupFile> & { recipes?: unknown[] };
  if (backup.version !== 1 || !Array.isArray(backup.recipes)) {
    throw new Error("Invalid backup format");
  }

  const existingKeys = new Set(existingRecipes.map((recipe) => normalizeText(`${recipe.name} ${recipe.sourceUrl ?? ""}`)));
  const now = new Date().toISOString();

  const recipes = backup.recipes.map((rawRecipe) => {
    const recipe = normalizeImportedRecipe(rawRecipe, now);
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

function normalizeTagList(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function recipeDatabaseBlob(recipes: Recipe[], tags: string[] = []) {
  const knownTags = new Set(tags.map((tag) => tag.trim()).filter(Boolean));
  const ingredientNames = new Set<string>();
  const recipeNames = new Set<string>();

  recipes.forEach((recipe) => {
    recipe.tags.forEach((tag) => {
      const trimmed = tag.trim();
      if (trimmed) knownTags.add(trimmed);
    });

    const recipeName = recipe.name.trim();
    if (recipeName) recipeNames.add(recipeName);

    recipe.ingredients.forEach((ingredient) => {
      const name = ingredient.name.trim();
      if (name) ingredientNames.add(name);
    });
  });

  const payload: RecipeDatabaseJson = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: [...knownTags].sort((a, b) => a.localeCompare(b, "fr")),
    ingredients: [...ingredientNames].sort((a, b) => a.localeCompare(b, "fr")),
    recipeNames: [...recipeNames].sort((a, b) => a.localeCompare(b, "fr")),
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function recipeImportExampleBlob() {
  const example: BackupFile = {
    version: 1,
    exportedAt: "2026-05-23T12:00:00.000Z",
    tags: ["TagExample1", "TagExample2"],
    recipes: [
      {
        id: "recipe-example-1",
        name: "RecipeNameExample",
        tags: ["TagExample1", "TagExample2"],
        origin: "OriginExample",
        ingredients: [
          { id: "ingredient-example-1", name: "IngredientExample1", quantity: "200", unit: "g" },
          { id: "ingredient-example-2", name: "IngredientExample2", quantity: "2", unit: "pieces" },
          { id: "ingredient-example-3", name: "IngredientExample3", note: "optional note example" },
        ],
        instructions: [
          "StepExample1",
          "StepExample2",
          "StepExample3",
        ],
        sourceUrl: "https://example.com/recipe-example",
        videoUrl: "https://example.com/video-example",
        servings: 4,
        prepTime: 10,
        restTime: 0,
        cookTime: 20,
        totalTime: 30,
        notes: "NotesExample",
        imageUrl: "https://example.com/image-example.jpg",
        sourceImageUrl: "https://example.com/image-source-example.jpg",
        createdAt: "2026-05-23T12:00:00.000Z",
        updatedAt: "2026-05-23T12:00:00.000Z",
      },
    ],
  };
  return new Blob([JSON.stringify(example, null, 2)], { type: "application/json" });
}

function normalizeImportedRecipe(input: unknown, now: string): Recipe {
  const record = (input && typeof input === "object" ? input : {}) as Partial<Recipe>;
  const name = (typeof record.name === "string" ? record.name.trim() : "") || "Recette importee";

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : createId(),
    name,
    tags: Array.isArray(record.tags) ? record.tags.map((tag) => `${tag}`.trim()).filter(Boolean) : [],
    origin: typeof record.origin === "string" && record.origin.trim() ? record.origin.trim() : undefined,
    ingredients: Array.isArray(record.ingredients)
      ? record.ingredients.map((ingredient) => ({
          id: typeof ingredient?.id === "string" && ingredient.id.trim() ? ingredient.id : createId(),
          name: typeof ingredient?.name === "string" ? ingredient.name : "",
          quantity: typeof ingredient?.quantity === "string" ? ingredient.quantity : undefined,
          unit: typeof ingredient?.unit === "string" ? ingredient.unit : undefined,
          note: typeof ingredient?.note === "string" ? ingredient.note : undefined,
        }))
      : [],
    instructions: Array.isArray(record.instructions) ? record.instructions.map((step) => `${step}`.trim()).filter(Boolean) : [],
    sourceUrl: typeof record.sourceUrl === "string" && record.sourceUrl.trim() ? record.sourceUrl.trim() : undefined,
    videoUrl: typeof record.videoUrl === "string" && record.videoUrl.trim() ? record.videoUrl.trim() : undefined,
    servings: typeof record.servings === "number" ? record.servings : undefined,
    prepTime: typeof record.prepTime === "number" ? record.prepTime : undefined,
    restTime: typeof record.restTime === "number" ? record.restTime : undefined,
    cookTime: typeof record.cookTime === "number" ? record.cookTime : undefined,
    totalTime: typeof record.totalTime === "number" ? record.totalTime : undefined,
    notes: typeof record.notes === "string" && record.notes.trim() ? record.notes : undefined,
    imageUrl: typeof record.imageUrl === "string" && record.imageUrl.trim() ? record.imageUrl.trim() : undefined,
    sourceImageUrl: typeof record.sourceImageUrl === "string" && record.sourceImageUrl.trim() ? record.sourceImageUrl.trim() : undefined,
    createdAt: typeof record.createdAt === "string" && record.createdAt.trim() ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : now,
  };
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
