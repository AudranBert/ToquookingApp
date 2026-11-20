import type { Recipe, RecipeDraft } from "../types";
import { createId } from "./id";
import { cleanRecipeDraft, nowIso } from "./recipes";

const SHARE_HASH_KEY = "toqueRecipe";

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

function decodeRecipeSharePayload(payload: string): Recipe | null {
  try {
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
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
  sv?: number | string;
  pt?: number;
  rt?: number;
  ct?: number;
  tt?: number;
  no?: string;
  im?: string;
  si?: string;
  ims?: string[];
  sis?: string[];
};

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
    servings:
      typeof compact.sv === "number" || typeof compact.sv === "string" ? compact.sv : undefined,
    prepTime: typeof compact.pt === "number" ? compact.pt : undefined,
    restTime: typeof compact.rt === "number" ? compact.rt : undefined,
    cookTime: typeof compact.ct === "number" ? compact.ct : undefined,
    totalTime: typeof compact.tt === "number" ? compact.tt : undefined,
    notes: typeof compact.no === "string" ? compact.no : "",
    imageUrl: typeof compact.im === "string" ? compact.im : "",
    imageUrls: Array.isArray(compact.ims) ? compact.ims.map((x) => `${x}`) : [],
    sourceImageUrl: typeof compact.si === "string" ? compact.si : "",
    sourceImageUrls: Array.isArray(compact.sis) ? compact.sis.map((x) => `${x}`) : [],
  };
}
