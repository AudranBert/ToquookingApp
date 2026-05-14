import type { ParsedRecipe } from "./types";
import { findKnownRecipeOrigin } from "./origins";
import { parseIngredientLine } from "./utils/ingredients";
import { createId } from "./utils/id";

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "(c)",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ugrave: "ù",
  ucirc: "û",
  ccedil: "ç",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
      const key = code.toLowerCase();
      if (key.startsWith("#x")) {
        const character = Number.parseInt(key.slice(2), 16);
        return Number.isFinite(character) ? String.fromCodePoint(character) : entity;
      }
      if (key.startsWith("#")) {
        const character = Number.parseInt(key.slice(1), 10);
        return Number.isFinite(character) ? String.fromCodePoint(character) : entity;
      }
      return HTML_ENTITIES[key] ?? entity;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function cleanText(value: unknown) {
  if (value == null) return "";
  return decodeHtmlEntities(String(value))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDurationToMinutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
  const simple = value.match(/(\d+)/);
  return simple ? Number(simple[1]) : undefined;
}

function arrayify(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(arrayify).filter(Boolean);
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(/\n|;/)
      .map(cleanText)
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return arrayify(node.url ?? node.contentUrl ?? node.embedUrl ?? node.text ?? node.name);
  }
  return [];
}

function metadataValues(recipe: Record<string, unknown>) {
  return [
    ...arrayify(recipe.keywords),
    ...arrayify(recipe.recipeCategory),
    ...arrayify(recipe.recipeCuisine),
  ].map((value) => value.trim()).filter(Boolean);
}

function extractRecipeFromJsonLd(json: unknown): ParsedRecipe | null {
  const nodes = Array.isArray(json) ? json : [json];
  const flattened = nodes.flatMap((node) => {
    if (node && typeof node === "object" && "@graph" in node && Array.isArray(node["@graph"])) {
      return node["@graph"] as unknown[];
    }
    return [node];
  });

  const recipe = flattened.find((node) => {
    if (!node || typeof node !== "object") return false;
    const type = (node as Record<string, unknown>)["@type"];
    return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
  }) as Record<string, unknown> | undefined;

  if (!recipe) return null;

  const instructionValues = Array.isArray(recipe.recipeInstructions)
    ? recipe.recipeInstructions.flatMap(instructionText)
    : arrayify(recipe.recipeInstructions);

  const images = arrayify(recipe.image);

  return {
    name: arrayify(recipe.name)[0],
    origin: findKnownRecipeOrigin(arrayify(recipe.recipeCuisine)),
    tags: metadataValues(recipe),
    ingredients: arrayify(recipe.recipeIngredient).map(parseIngredientLine),
    instructions: instructionValues.filter(Boolean),
    servings: servings(recipe.recipeYield),
    prepTime: parseDurationToMinutes(recipe.prepTime),
    cookTime: parseDurationToMinutes(recipe.cookTime),
    totalTime: parseDurationToMinutes(recipe.totalTime),
    imageUrl: images[0],
    videoUrl: recipeVideoUrl(recipe),
  };
}

function instructionText(item: unknown): string[] {
  if (typeof item === "string") return arrayify(item);
  if (!item || typeof item !== "object") return [];

  const node = item as Record<string, unknown>;
  const nested = node.itemListElement ?? node.steps ?? node.recipeInstructions;
  if (nested) return arrayify(node.text ?? node.name).concat(Array.isArray(nested) ? nested.flatMap(instructionText) : instructionText(nested));

  return arrayify(node.text ?? node.name);
}

function servings(value: unknown) {
  const first = arrayify(value)[0];
  if (!first) return undefined;
  return Number.parseInt(first, 10) || undefined;
}

function recipeVideoUrl(recipe: Record<string, unknown>) {
  const firstVideo = Array.isArray(recipe.video) ? recipe.video[0] : recipe.video;
  return arrayify(firstVideo)[0];
}

export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const endpoint = `/api/import?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    if (response.ok) return response.json();
  } catch {
    // Local static builds do not always have the serverless endpoint.
  } finally {
    window.clearTimeout(timer);
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    return {
      sourceUrl: url,
      videoUrl: url,
      name: "Recette YouTube",
      warnings: ["Import YouTube partiel : vérifie le titre, les ingrédients et les étapes manuellement."],
    };
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    const jsonLdScripts = [
      ...html.matchAll(
        /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ];
    for (const match of jsonLdScripts) {
      const parsed = extractRecipeFromJsonLd(JSON.parse(match[1]));
      if (parsed) {
        const warnings = parsed.name?.trim()
          ? undefined
          : ["Aucun nom détecté dans la recette importée. Renseigne-le manuellement."];
        return { ...parsed, sourceUrl: url, warnings };
      }
    }
  } catch {
    return {
      sourceUrl: url,
      warnings: ["Import automatique indisponible pour ce site. Le lien est conservé, complète la recette manuellement."],
    };
  }

  return {
    sourceUrl: url,
    warnings: ["Aucune recette structurée trouvée. Le lien est conservé, complète les champs manquants."],
  };
}
