import { parseIngredientLine, type ParsedIngredient } from "../src/utils/ingredientParser";

type ImportedIngredient = ParsedIngredient;

export type ImportedRecipe = {
  name?: string;
  sourceUrl?: string;
  videoUrl?: string;
  ingredients?: ImportedIngredient[];
  instructions?: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  imageUrl?: string;
  warnings: string[];
};

type RecipeNode = Record<string, unknown>;

function textArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  if (value && typeof value === "object" && "url" in value && typeof value.url === "string") return [value.url];
  return [];
}

function minutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
  const simple = value.match(/(\d+)/);
  return simple ? Number(simple[1]) : undefined;
}

function parseJsonLd(html: string) {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const script of scripts) {
    try {
      const json = JSON.parse(script[1]);
      const nodes = Array.isArray(json) ? json : [json];
      const graph = nodes.flatMap((node) =>
        node && typeof node === "object" && Array.isArray((node as RecipeNode)["@graph"])
          ? ((node as RecipeNode)["@graph"] as unknown[])
          : [node],
      );
      const recipe = graph.find((node) => {
        if (!node || typeof node !== "object") return false;
        const type = (node as RecipeNode)["@type"];
        return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
      });

      if (recipe && typeof recipe === "object") return recipe as RecipeNode;
    } catch {
      continue;
    }
  }

  return null;
}

function recipeNodeToImport(recipe: RecipeNode, url: string): ImportedRecipe {
  const instructions = Array.isArray(recipe.recipeInstructions)
    ? recipe.recipeInstructions
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "text" in item) return String(item.text);
          return "";
        })
        .filter(Boolean)
    : textArray(recipe.recipeInstructions);

  return {
    name: typeof recipe.name === "string" ? recipe.name : undefined,
    sourceUrl: url,
    ingredients: textArray(recipe.recipeIngredient).map(parseIngredientLine),
    instructions,
    servings: typeof recipe.recipeYield === "string" ? Number.parseInt(recipe.recipeYield, 10) || undefined : undefined,
    prepTime: minutes(recipe.prepTime),
    cookTime: minutes(recipe.cookTime),
    totalTime: minutes(recipe.totalTime),
    imageUrl: textArray(recipe.image)[0],
    warnings: ["Import assisté : vérifie les quantités et les étapes avant d'enregistrer."],
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ToqueRecipeHub/0.1 (+local recipe import)",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function importRecipeFromSourceUrl(url: string): Promise<ImportedRecipe> {
  if (!/^https?:\/\//.test(url)) {
    return { warnings: ["URL invalide."] };
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    return {
      name: "Recette YouTube",
      sourceUrl: url,
      videoUrl: url,
      warnings: ["Import YouTube partiel : complète les ingrédients et les étapes après vérification."],
    };
  }

  try {
    const page = await fetchWithTimeout(url);
    const html = await page.text();
    const recipe = parseJsonLd(html);

    if (!recipe) {
      return {
        sourceUrl: url,
        warnings: ["Aucune donnée de recette structurée trouvée. Complète la fiche manuellement."],
      };
    }

    return recipeNodeToImport(recipe, url);
  } catch {
    return {
      sourceUrl: url,
      warnings: ["Impossible de lire ce lien pour le moment. Le lien est gardé pour une saisie manuelle."],
    };
  }
}
