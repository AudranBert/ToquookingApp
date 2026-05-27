import type { Recipe, RecipeDraft } from "../types";
import { createId } from "./id";
import { cleanRecipeDraft, ingredientLabel, nowIso, recipeToDraft } from "./recipes";

const SHARE_HASH_KEY = "toqueRecipe";
const MAX_SHARE_URL_LENGTH = 3200;
const MAX_SMS_BODY_LENGTH = 1800;

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
  const shareableImageUrl = /^https?:\/\//i.test(recipe.imageUrl ?? "") ? recipe.imageUrl : "";
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
    shareableImageUrl ? "" : "",
    shareableImageUrl ? `Image: ${shareableImageUrl}` : "",
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
    if (text.length > MAX_SMS_BODY_LENGTH) {
      downloadTextFile(text, recipeTextFileName(recipe));
      return "downloaded";
    }
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

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

export async function shareRecipeLink(recipe: Recipe) {
  const url = createRecipeShareUrl(recipe);
  if (url.length > MAX_SHARE_URL_LENGTH) {
    return "too_long";
  }
  const text = `Recette Toque: ${recipe.name}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: recipe.name, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}

function encodeRecipeSharePayload(recipe: Recipe) {
  const json = JSON.stringify(compactRecipeDraft(cleanRecipeDraft(recipeToDraft(recipe))));
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
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const draft = expandSharedDraft(parsed);
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

type CompactIngredient = [string, string?, string?, string?];
type CompactDraftV2 = {
  v: 2;
  n: string;
  t?: string[];
  o?: string;
  i?: CompactIngredient[];
  s?: string[];
  u?: string;
  vv?: string;
  sv?: number;
  pt?: number;
  rt?: number;
  ct?: number;
  tt?: number;
  no?: string;
  im?: string;
  si?: string;
};

function compactRecipeDraft(draft: RecipeDraft): CompactDraftV2 {
  return {
    v: 2,
    n: draft.name,
    t: draft.tags.length ? draft.tags : undefined,
    o: draft.origin || undefined,
    i: draft.ingredients.map((item) => [item.name, item.quantity, item.unit, item.note]),
    s: draft.instructions.length ? draft.instructions : undefined,
    u: draft.sourceUrl || undefined,
    vv: draft.videoUrl || undefined,
    sv: draft.servings,
    pt: draft.prepTime,
    rt: draft.restTime,
    ct: draft.cookTime,
    tt: draft.totalTime,
    no: draft.notes || undefined,
    im: draft.imageUrl || undefined,
    si: draft.sourceImageUrl || undefined,
  };
}

function expandSharedDraft(parsed: unknown): RecipeDraft {
  if (!parsed || typeof parsed !== "object") return parsed as RecipeDraft;
  const compact = parsed as Partial<CompactDraftV2>;
  if (compact.v !== 2 || typeof compact.n !== "string") {
    return parsed as RecipeDraft;
  }

  return {
    name: compact.n,
    tags: Array.isArray(compact.t) ? compact.t.map((x) => `${x}`) : [],
    origin: typeof compact.o === "string" ? compact.o : "",
    ingredients: Array.isArray(compact.i)
      ? compact.i.map((item) => ({
          id: createId(),
          name: `${item?.[0] ?? ""}`,
          quantity: typeof item?.[1] === "string" ? item[1] : "",
          unit: typeof item?.[2] === "string" ? item[2] : "",
          note: typeof item?.[3] === "string" ? item[3] : "",
        }))
      : [],
    instructions: Array.isArray(compact.s) ? compact.s.map((x) => `${x}`) : [],
    sourceUrl: typeof compact.u === "string" ? compact.u : "",
    videoUrl: typeof compact.vv === "string" ? compact.vv : "",
    servings: typeof compact.sv === "number" ? compact.sv : undefined,
    prepTime: typeof compact.pt === "number" ? compact.pt : undefined,
    restTime: typeof compact.rt === "number" ? compact.rt : undefined,
    cookTime: typeof compact.ct === "number" ? compact.ct : undefined,
    totalTime: typeof compact.tt === "number" ? compact.tt : undefined,
    notes: typeof compact.no === "string" ? compact.no : "",
    imageUrl: typeof compact.im === "string" ? compact.im : "",
    sourceImageUrl: typeof compact.si === "string" ? compact.si : "",
  };
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
