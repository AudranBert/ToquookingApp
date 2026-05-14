import type { Recipe, RecipeDraft } from "../types";
import { createId } from "./id";
import { cleanRecipeDraft, nowIso, recipeToDraft } from "./recipes";

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
