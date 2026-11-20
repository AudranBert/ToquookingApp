import type { Recipe } from "../types";
import { cleanStoredRecipe } from "../utils/recipes";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeUrl(value: string | undefined, allowImage = false) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (allowImage && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value))
    return value;
  return undefined;
}

/** A shared link may point to somebody else's server: treat its JSON as untrusted. */
export function parseCloudRecipe(value: unknown): Recipe {
  if (!isObject(value)) throw new Error("Invalid cloud recipe");
  for (const field of ["id", "name", "createdAt", "updatedAt"]) {
    if (typeof value[field] !== "string") throw new Error("Invalid cloud metadata");
  }
  for (const field of ["tags", "instructions"]) {
    if (!Array.isArray(value[field]) || !value[field].every((item) => typeof item === "string"))
      throw new Error("Invalid cloud list");
  }
  if (
    !Array.isArray(value.ingredients) ||
    !value.ingredients.every(
      (item) =>
        isObject(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        ["quantity", "unit", "note"].every(
          (field) => item[field] == null || typeof item[field] === "string"
        )
    )
  )
    throw new Error("Invalid cloud ingredients");
  for (const field of ["origin", "notes", "sourceUrl", "videoUrl", "imageUrl", "sourceImageUrl"]) {
    if (value[field] != null && typeof value[field] !== "string")
      throw new Error("Invalid cloud field");
  }
  for (const field of ["imageUrls", "sourceImageUrls"]) {
    if (
      value[field] != null &&
      (!Array.isArray(value[field]) || !value[field].every((item) => typeof item === "string"))
    )
      throw new Error("Invalid cloud images");
  }
  for (const field of ["prepTime", "restTime", "cookTime", "totalTime"]) {
    if (
      value[field] != null &&
      (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0)
    )
      throw new Error("Invalid cloud timing");
  }
  if (
    value.servings != null &&
    typeof value.servings !== "string" &&
    (typeof value.servings !== "number" || !Number.isFinite(value.servings))
  )
    throw new Error("Invalid cloud servings");
  const recipe = cleanStoredRecipe(value as Recipe);
  if (
    !recipe.name ||
    !recipe.id ||
    !Number.isFinite(Date.parse(recipe.createdAt)) ||
    !Number.isFinite(Date.parse(recipe.updatedAt))
  )
    throw new Error("Invalid cloud recipe");
  return {
    ...recipe,
    sourceUrl: safeUrl(recipe.sourceUrl),
    videoUrl: safeUrl(recipe.videoUrl),
    imageUrl: safeUrl(recipe.imageUrl, true),
    sourceImageUrl: safeUrl(recipe.sourceImageUrl, true),
    imageUrls: recipe.imageUrls
      ?.map((url) => safeUrl(url, true))
      .filter((url): url is string => Boolean(url)),
    sourceImageUrls: recipe.sourceImageUrls
      ?.map((url) => safeUrl(url, true))
      .filter((url): url is string => Boolean(url)),
  };
}
