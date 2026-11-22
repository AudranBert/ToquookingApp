import type { ParsedRecipe, Recipe } from "../types";
import { createId } from "../utils/id";
import { mergedRecipeImageUrls } from "../utils/images";
import { nowIso } from "../utils/recipes";
import { normalizeText } from "../utils/text";
import { matchKnownTags } from "./recipeDraft";

export function createPendingImport(url: string): Recipe {
  const name = nameFromUrl(url);
  const now = nowIso();
  return {
    id: createId(),
    name,
    tags: ["Brouillon"],
    ingredients: [],
    instructions: [],
    sourceUrl: url,
    importStatus: "pending",
    importPlaceholderName: name,
    createdAt: now,
    updatedAt: now,
  };
}

export function completePendingImport(
  current: Recipe,
  parsed: ParsedRecipe,
  knownTags: string[]
): Recipe {
  const importedImages = mergedRecipeImageUrls({
    imageUrl: parsed.imageUrl,
    imageUrls: parsed.imageUrls,
  });
  const currentImages = mergedRecipeImageUrls(current);
  const importedTags = matchKnownTags(parsed.tags ?? [], knownTags);
  const replacePlaceholderName = current.name === current.importPlaceholderName;

  return {
    ...current,
    name: replacePlaceholderName && parsed.name ? parsed.name : current.name,
    sourceUrl: current.sourceUrl || parsed.sourceUrl,
    videoUrl: current.videoUrl || parsed.videoUrl,
    servings: current.servings ?? parsed.servings,
    prepTime: current.prepTime ?? parsed.prepTime,
    restTime: current.restTime ?? parsed.restTime,
    cookTime: current.cookTime ?? parsed.cookTime,
    totalTime: current.totalTime ?? parsed.totalTime,
    notes: current.notes || parsed.notes,
    origin: current.origin || parsed.origin,
    tags: [
      ...new Set([
        ...current.tags.filter((tag) => !["brouillon", "draft"].includes(normalizeText(tag))),
        ...importedTags,
      ]),
    ],
    ingredients: current.ingredients.length ? current.ingredients : (parsed.ingredients ?? []),
    instructions: current.instructions.length ? current.instructions : (parsed.instructions ?? []),
    imageUrl: current.imageUrl || importedImages[0],
    imageUrls: currentImages.length ? currentImages : importedImages,
    sourceImageUrl: current.sourceImageUrl || importedImages[0],
    sourceImageUrls: current.sourceImageUrls?.length ? current.sourceImageUrls : importedImages,
    importStatus: undefined,
    importPlaceholderName: undefined,
    importError: undefined,
    updatedAt: nowIso(),
  };
}

export function failPendingImport(current: Recipe, message: string): Recipe {
  return {
    ...current,
    importStatus: "failed",
    importError: message,
    updatedAt: nowIso(),
  };
}

export function hasImportedContent(parsed: ParsedRecipe) {
  return Boolean(
    parsed.ingredients?.length ||
    parsed.instructions?.length ||
    parsed.name ||
    parsed.videoUrl ||
    parsed.imageUrl
  );
}

function nameFromUrl(sourceUrl: string) {
  try {
    const tail = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "";
    const name = decodeURIComponent(tail)
      .replace(/^recette[_-]/i, "")
      .replace(/_[0-9]+(?:\.aspx)?$/i, "")
      .replace(/\.(?:aspx|html?)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return name
      ? name.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
      : "Recette à importer";
  } catch {
    return "Recette à importer";
  }
}
