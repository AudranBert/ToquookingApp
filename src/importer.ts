import type { ParsedRecipe } from "./types";
import { findKnownRecipeOrigin } from "./origins";
import { parseIngredientLine } from "./utils/ingredients";
import { createId } from "./utils/id";

function parseDurationToMinutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
  const simple = value.match(/(\d+)/);
  return simple ? Number(simple[1]) : undefined;
}

function arrayify(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
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
    ? recipe.recipeInstructions.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) return String(item.text);
        return "";
      })
    : arrayify(recipe.recipeInstructions);

  const images = arrayify(recipe.image);

  return {
    name: typeof recipe.name === "string" ? recipe.name : undefined,
    origin: findKnownRecipeOrigin(arrayify(recipe.recipeCuisine)),
    tags: metadataValues(recipe),
    ingredients: arrayify(recipe.recipeIngredient).map(parseIngredientLine),
    instructions: instructionValues.filter(Boolean),
    servings: typeof recipe.recipeYield === "string" ? Number.parseInt(recipe.recipeYield, 10) || undefined : undefined,
    prepTime: parseDurationToMinutes(recipe.prepTime),
    cookTime: parseDurationToMinutes(recipe.cookTime),
    totalTime: parseDurationToMinutes(recipe.totalTime),
    imageUrl: images[0],
  };
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
