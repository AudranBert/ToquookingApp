import { copyText } from "./clipboard";
import { shareText } from "./sharing";
import type { Recipe } from "../types";
import { t } from "../i18n";
import { createId } from "./id";
import { cleanRecipeDraft, ingredientLabel, nowIso, recipeToDraft } from "./recipes";
import { primaryRecipeImageUrl } from "./images";
import { displayTagName } from "./tags";

export function sharedRecipeToImport(recipe: Recipe, existingRecipes: Recipe[]): Recipe {
  const draft = cleanRecipeDraft(recipeToDraft(recipe));
  const existingKeys = new Set(existingRecipes.map(recipeImportKey));
  const importedName = existingKeys.has(recipeImportKey(recipe))
    ? `${draft.name} (import)`
    : draft.name;

  return {
    ...draft,
    id: createId(),
    name: importedName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function recipeToShareText(recipe: Recipe) {
  const shareableImageUrl = /^https?:\/\//i.test(primaryRecipeImageUrl(recipe) ?? "")
    ? primaryRecipeImageUrl(recipe)
    : "";
  const lines = [
    recipe.name,
    "",
    formatMeta(recipe),
    recipe.tags.length
      ? `${t("share.text.tagsLabel")}: ${recipe.tags.map(displayTagName).join(", ")}`
      : "",
    recipe.origin ? `${t("share.text.originLabel")}: ${recipe.origin}` : "",
    "",
    `${t("share.text.ingredientsLabel")}:`,
    ...recipe.ingredients.map((ingredient) => `- ${ingredientLabel(ingredient)}`),
    "",
    `${t("share.text.instructionsLabel")}:`,
    ...recipe.instructions.map((step, index) => `${index + 1}. ${step}`),
    recipe.notes ? "" : "",
    recipe.notes ? `${t("share.text.notesLabel")}:` : "",
    recipe.notes ?? "",
    shareableImageUrl ? "" : "",
    shareableImageUrl ? `${t("share.text.imageLabel")}: ${shareableImageUrl}` : "",
    recipe.sourceUrl ? "" : "",
    recipe.sourceUrl ? `${t("share.text.sourceLabel")}: ${recipe.sourceUrl}` : "",
    recipe.videoUrl ? `${t("share.text.videoLabel")}: ${recipe.videoUrl}` : "",
  ];

  return lines
    .filter((line, index, allLines) => line || allLines[index - 1])
    .join("\n")
    .trim();
}

export async function shareRecipeText(recipe: Recipe) {
  return shareText(recipeToShareText(recipe), recipeTextFileName(recipe), recipe.name);
}

function recipeTextFileName(recipe: Recipe) {
  const slug = recipe.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `toque-recette-${slug || "recette"}.txt`;
}

export async function copyRecipeShareLink(url: string) {
  try {
    await copyText(url);
    return "copied";
  } catch {
    return "manual";
  }
}

function recipeImportKey(recipe: Pick<Recipe, "name" | "sourceUrl">) {
  return `${recipe.name.trim().toLowerCase()} ${recipe.sourceUrl?.trim().toLowerCase() ?? ""}`;
}

function formatMeta(recipe: Recipe) {
  const meta = [
    recipe.servings ? t("share.text.meta.servings", { count: recipe.servings }) : "",
    recipe.prepTime ? t("share.text.meta.prep", { minutes: recipe.prepTime }) : "",
    recipe.restTime ? t("share.text.meta.rest", { minutes: recipe.restTime }) : "",
    recipe.cookTime ? t("share.text.meta.cook", { minutes: recipe.cookTime }) : "",
    recipe.totalTime ? t("share.text.meta.total", { minutes: recipe.totalTime }) : "",
  ].filter(Boolean);

  return meta.length ? meta.join(" | ") : "";
}
