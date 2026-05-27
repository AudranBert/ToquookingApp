import { normalizeText } from "../seasonal";
import type { BackupFile, Recipe, RecipeTag } from "../types";
import { createId } from "./id";
import JSZip from "jszip";
import { mergedRecipeImageUrls } from "./images";

type RecipeDatabaseJson = {
  version: 1;
  exportedAt: string;
  tags: string[];
  ingredients: string[];
  recipeNames: string[];
};

export function downloadRecipesBackup(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  void recipesBackupZipBlob(recipes, tags).then((blob) => downloadBlob(blob, recipesBackupFileName()));
}

export function downloadRecipeImportExample() {
  void recipeImportExampleZipBlob().then((blob) => downloadBlob(blob, "toque-exemple-import.zip"));
}

export function downloadRecipeDatabaseJson(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  downloadBlob(recipeDatabaseBlob(recipes, tags), "toque-base-recettes.json");
}

export async function shareRecipesBackup(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  const filename = recipesBackupFileName();
  const blob = await recipesBackupZipBlob(recipes, tags);
  const zipFile = new File([blob], filename, { type: "application/zip" });
  if (await tryShare({ files: [zipFile] })) {
    return "shared";
  }

  downloadRecipesBackup(recipes, tags);
  return "downloaded";
}

function recipesBackupTextBlob(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  const globalTags = normalizeTagRecords([
    ...tags,
    ...recipes.flatMap((recipe) => recipe.tags.map((name) => ({ name }))),
  ]);
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: globalTags,
    recipes,
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
}

async function recipesBackupZipBlob(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  const zip = new JSZip();
  const recipeFolder = zip.folder("recipes");
  const imageFolder = zip.folder("images");
  const imagePathByDataUrl = new Map<string, string>();

  const backupBlob = recipesBackupTextBlob(recipes, tags);
  zip.file("backup.json", await backupBlob.text());
  zip.file("database.json", await recipeDatabaseBlob(recipes, tags).text());

  for (const recipe of recipes) {
    const recipeForFile: Recipe = { ...recipe };
    recipeForFile.imageUrl = await exportImageToZip(recipe.imageUrl, imageFolder, imagePathByDataUrl, recipe.id, "image");
    recipeForFile.imageUrls = (
      await Promise.all((recipe.imageUrls ?? []).map((url) => exportImageToZip(url, imageFolder, imagePathByDataUrl, recipe.id, "image")))
    ).filter((url): url is string => Boolean(url));
    recipeForFile.sourceImageUrl = await exportImageToZip(recipe.sourceImageUrl, imageFolder, imagePathByDataUrl, recipe.id, "source");
    recipeForFile.sourceImageUrls = (
      await Promise.all((recipe.sourceImageUrls ?? []).map((url) => exportImageToZip(url, imageFolder, imagePathByDataUrl, recipe.id, "source")))
    ).filter((url): url is string => Boolean(url));
    const name = `${safeSlug(recipe.name)}-${recipe.id}.json`;
    recipeFolder?.file(name, JSON.stringify(recipeForFile, null, 2));
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadSingleRecipeBackup(recipe: Recipe) {
  void singleRecipeBackupZipBlob(recipe).then((blob) => downloadBlob(blob, recipeBackupFileName(recipe)));
}

export async function shareSingleRecipeBackup(recipe: Recipe) {
  const filename = recipeBackupFileName(recipe);
  const blob = await singleRecipeBackupZipBlob(recipe);
  const zipFile = new File([blob], filename, { type: "application/zip" });
  if (await tryShare({ files: [zipFile] })) {
    return "shared";
  }

  downloadSingleRecipeBackup(recipe);
  return "downloaded";
}

function singleRecipeBackupTextBlob(recipe: Recipe) {
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: normalizeTagRecords(recipe.tags.map((name) => ({ name }))),
    recipes: [recipe],
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
}

async function singleRecipeBackupZipBlob(recipe: Recipe) {
  return recipesBackupZipBlob([recipe], normalizeTagRecords(recipe.tags.map((name) => ({ name }))));
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function parseBackupFile(file: File, existingRecipes: Recipe[]) {
  const parsed = file.name.toLowerCase().endsWith(".zip")
    ? await parseZipBackup(file)
    : parseJsonBackup(await file.text());
  if (!Array.isArray(parsed.recipes)) throw new Error("Invalid backup format");

  const existingKeys = new Set(existingRecipes.map((recipe) => normalizeText(`${recipe.name} ${recipe.sourceUrl ?? ""}`)));
  const now = new Date().toISOString();

  const recipes = parsed.recipes.map((rawRecipe) => {
    const recipe = normalizeImportedRecipe(rawRecipe, now);
    const key = normalizeText(`${recipe.name} ${recipe.sourceUrl ?? ""}`);
    return existingKeys.has(key)
      ? { ...recipe, id: createId(), name: `${recipe.name} (import)` }
      : recipe;
  });

  return {
    recipes,
    tags: parseImportedTags(parsed.tags),
  };
}

function recipeBackupFileName(recipe: Recipe) {
  const slug = recipe.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `toque-recette-${slug || "recette"}.zip`;
}

function recipesBackupFileName() {
  return `toque-sauvegarde-${new Date().toISOString().slice(0, 10)}.zip`;
}

function normalizeTagRecords(tags: Array<Pick<RecipeTag, "name" | "category" | "color">>) {
  const byName = new Map<string, Pick<RecipeTag, "name" | "category" | "color">>();
  tags.forEach((tag) => {
    const name = tag.name?.trim();
    if (!name) return;
    const key = normalizeText(name);
    const current = byName.get(key);
    byName.set(key, {
      name,
      category: tag.category?.trim() || current?.category,
      color: tag.color?.trim() || current?.color,
    });
  });
  return [...byName.values()];
}

function parseImportedTags(tags: unknown) {
  if (!Array.isArray(tags)) return [] as Array<Pick<RecipeTag, "name" | "category" | "color">>;
  const normalized: Array<Pick<RecipeTag, "name" | "category" | "color">> = [];
  tags.forEach((tag) => {
    if (!tag || typeof tag !== "object") return;
    const candidate = tag as Partial<RecipeTag>;
    if (typeof candidate.name !== "string") return;
    normalized.push({ name: candidate.name, category: candidate.category, color: candidate.color });
  });
  return normalizeTagRecords(normalized);
}

function recipeDatabaseBlob(recipes: Recipe[], tags: Array<Pick<RecipeTag, "name" | "category" | "color">> = []) {
  const knownTags = new Set(
    tags
      .map((tag) => tag.name)
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
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
    tags: [{ name: "TagExample1" }, { name: "TagExample2" }],
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
        imageUrls: [
          "https://example.com/image-example.jpg",
          "https://example.com/image-example-2.jpg",
        ],
        sourceImageUrl: "https://example.com/image-source-example.jpg",
        sourceImageUrls: [
          "https://example.com/image-source-example.jpg",
          "https://example.com/image-source-example-2.jpg",
        ],
        createdAt: "2026-05-23T12:00:00.000Z",
        updatedAt: "2026-05-23T12:00:00.000Z",
      },
    ],
  };
  return new Blob([JSON.stringify(example, null, 2)], { type: "application/json" });
}

async function recipeImportExampleZipBlob() {
  const zip = new JSZip();
  const recipeFolder = zip.folder("recipes");
  zip.folder("images");
  const backup = JSON.parse(await recipeImportExampleBlob().text()) as BackupFile;
  zip.file("backup.json", JSON.stringify(backup, null, 2));
  for (const recipe of backup.recipes) {
    recipeFolder?.file(`${safeSlug(recipe.name)}-${recipe.id}.json`, JSON.stringify(recipe, null, 2));
  }
  return zip.generateAsync({ type: "blob" });
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
    imageUrls: mergedRecipeImageUrls({
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined,
      imageUrls: Array.isArray(record.imageUrls) ? record.imageUrls.map((value) => `${value}`) : [],
    }),
    sourceImageUrl: typeof record.sourceImageUrl === "string" && record.sourceImageUrl.trim() ? record.sourceImageUrl.trim() : undefined,
    sourceImageUrls: mergedRecipeImageUrls({
      imageUrl: typeof record.sourceImageUrl === "string" ? record.sourceImageUrl : undefined,
      imageUrls: Array.isArray(record.sourceImageUrls) ? record.sourceImageUrls.map((value) => `${value}`) : [],
    }),
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

function parseJsonBackup(text: string) {
  const backup = JSON.parse(text) as Partial<BackupFile> & { recipes?: unknown[] };
  if (backup.version !== 1 || !Array.isArray(backup.recipes)) throw new Error("Invalid backup format");
  return backup;
}

async function parseZipBackup(file: File) {
  const zip = await JSZip.loadAsync(file);
  const backupFile = zip.file("backup.json");
  const recipeFiles = Object.values(zip.files).filter((entry) => /^recipes\/.+\.json$/i.test(entry.name));

  const base = backupFile ? parseJsonBackup(await backupFile.async("string")) : ({ version: 1 } as Partial<BackupFile>);
  let recipes: unknown[] = [];

  if (recipeFiles.length > 0) {
    recipes = await Promise.all(recipeFiles.map(async (entry) => JSON.parse(await entry.async("string")) as unknown));
  } else if (Array.isArray(base.recipes)) {
    recipes = base.recipes;
  } else {
    throw new Error("Invalid backup format");
  }

  const images = new Map<string, string>();
  const imageFiles = Object.values(zip.files).filter((entry) => /^images\/.+$/i.test(entry.name));
  await Promise.all(
    imageFiles.map(async (entry) => {
      const bytes = await entry.async("uint8array");
      images.set(entry.name, uint8ToDataUrl(bytes, guessMimeType(entry.name)));
    }),
  );

  const hydratedRecipes = recipes.map((raw) => hydrateRecipeImageRefs(raw, images));
  return { ...base, recipes: hydratedRecipes };
}

function hydrateRecipeImageRefs(raw: unknown, images: Map<string, string>) {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Partial<Recipe>;
  return {
    ...record,
    imageUrl: hydrateImageRef(record.imageUrl, images),
    imageUrls: Array.isArray(record.imageUrls) ? record.imageUrls.map((url) => hydrateImageRef(url, images) ?? "").filter(Boolean) : undefined,
    sourceImageUrl: hydrateImageRef(record.sourceImageUrl, images),
    sourceImageUrls: Array.isArray(record.sourceImageUrls) ? record.sourceImageUrls.map((url) => hydrateImageRef(url, images) ?? "").filter(Boolean) : undefined,
  };
}

function hydrateImageRef(value: string | undefined, images: Map<string, string>) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const normalized = value.replace(/^\.?\//, "");
  return images.get(normalized) ?? value;
}

async function exportImageToZip(
  value: string | undefined,
  folder: JSZip | null,
  imagePathByDataUrl: Map<string, string>,
  recipeId: string,
  role: "image" | "source",
) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("data:")) return value;

  const existingPath = imagePathByDataUrl.get(value);
  if (existingPath) return existingPath;

  const parsed = parseDataUrl(value);
  if (!parsed) return value;
  const extension = extensionFromMime(parsed.mimeType);
  const path = `images/${recipeId}-${role}.${extension}`;
  folder?.file(`${recipeId}-${role}.${extension}`, parsed.bytes);
  imagePathByDataUrl.set(value, path);
  return path;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = match[2] === ";base64";
  const raw = match[3] ?? "";
  if (!isBase64) {
    const text = decodeURIComponent(raw);
    return { mimeType, bytes: new TextEncoder().encode(text) };
  }
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mimeType, bytes };
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("bmp")) return "bmp";
  return "jpg";
}

function guessMimeType(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

function uint8ToDataUrl(bytes: Uint8Array, mimeType: string) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "recette";
}
