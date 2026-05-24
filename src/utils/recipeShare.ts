import type { Recipe, RecipeDraft } from "../types";
import { createId } from "./id";
import { cleanRecipeDraft, ingredientLabel, nowIso, recipeToDraft } from "./recipes";

const SHARE_HASH_KEY = "toqueRecipe";

export function createRecipeShareUrl(recipe: Recipe) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `${SHARE_HASH_KEY}=${encodeRecipeSharePayload(recipe)}`;
  return url.toString();
}

export function readRecipeShareFromLocation() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const payload = params.get(SHARE_HASH_KEY);
  if (!payload) return null;
  return decodeRecipeSharePayload(payload);
}

export function clearRecipeShareFromLocation() {
  if (!window.location.hash.includes(`${SHARE_HASH_KEY}=`)) return;
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url);
}

export function sharedRecipeToImport(recipe: Recipe, existingRecipes: Recipe[]): Recipe {
  const draft = cleanRecipeDraft(recipeToDraft(recipe));
  const existingKeys = new Set(existingRecipes.map(recipeImportKey));
  const importedName = existingKeys.has(recipeImportKey(recipe)) ? `${draft.name} (import)` : draft.name;

  return {
    ...draft,
    id: createId(),
    name: importedName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function recipeToShareText(recipe: Recipe) {
  const lines = [
    recipe.name,
    "",
    formatMeta(recipe),
    recipe.tags.length ? `Tags: ${recipe.tags.join(", ")}` : "",
    recipe.origin ? `Origine: ${recipe.origin}` : "",
    "",
    "Ingredients:",
    ...recipe.ingredients.map((ingredient) => `- ${ingredientLabel(ingredient)}`),
    "",
    "Instructions:",
    ...recipe.instructions.map((step, index) => `${index + 1}. ${step}`),
    recipe.notes ? "" : "",
    recipe.notes ? "Notes:" : "",
    recipe.notes ?? "",
    recipe.sourceUrl ? "" : "",
    recipe.sourceUrl ? `Source: ${recipe.sourceUrl}` : "",
    recipe.videoUrl ? `Video: ${recipe.videoUrl}` : "",
  ];

  return lines.filter((line, index, allLines) => line || allLines[index - 1]).join("\n").trim();
}

export async function shareRecipeText(recipe: Recipe) {
  const text = recipeToShareText(recipe);
  if (navigator.share) {
    try {
      await navigator.share({ title: recipe.name, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  if (isLikelyMobile()) {
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    return "sms";
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}

function encodeRecipeSharePayload(recipe: Recipe) {
  const json = JSON.stringify(recipeToDraft(recipe));
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeRecipeSharePayload(payload: string): Recipe | null {
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const draft = JSON.parse(new TextDecoder().decode(bytes)) as RecipeDraft;
    const cleaned = cleanRecipeDraft(draft);
    if (!cleaned.name) return null;

    return {
      ...cleaned,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  } catch {
    return null;
  }
}

function recipeImportKey(recipe: Pick<Recipe, "name" | "sourceUrl">) {
  return `${recipe.name.trim().toLowerCase()} ${recipe.sourceUrl?.trim().toLowerCase() ?? ""}`;
}

function formatMeta(recipe: Recipe) {
  const meta = [
    recipe.servings ? `${recipe.servings} personne(s)` : "",
    recipe.prepTime ? `Preparation ${recipe.prepTime} min` : "",
    recipe.restTime ? `Repos ${recipe.restTime} min` : "",
    recipe.cookTime ? `Cuisson ${recipe.cookTime} min` : "",
    recipe.totalTime ? `Total ${recipe.totalTime} min` : "",
  ].filter(Boolean);

  return meta.length ? meta.join(" | ") : "";
}

function isLikelyMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
