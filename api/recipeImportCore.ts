import { parseIngredientLine, type ParsedIngredient } from "../src/utils/ingredientParser";
import { findKnownRecipeOrigin } from "../src/origins";

type ImportedIngredient = ParsedIngredient;

export type ImportedRecipe = {
  name?: string;
  sourceUrl?: string;
  videoUrl?: string;
  ingredients?: ImportedIngredient[];
  instructions?: string[];
  tags?: string[];
  origin?: string;
  servings?: number;
  prepTime?: number;
  restTime?: number;
  cookTime?: number;
  totalTime?: number;
  imageUrl?: string;
  warnings: string[];
};

type RecipeNode = Record<string, unknown>;

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

function textArray(value: unknown) {
  if (Array.isArray(value)) return value.flatMap(textArray).filter(Boolean);
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(/\n|;/)
      .map(cleanText)
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const node = value as RecipeNode;
    return textArray(node.url ?? node.contentUrl ?? node.embedUrl ?? node.text ?? node.name);
  }
  return [];
}

function metadataValues(recipe: RecipeNode) {
  return [
    ...textArray(recipe.keywords),
    ...textArray(recipe.recipeCategory),
    ...textArray(recipe.recipeCuisine),
  ].map((value) => value.trim()).filter(Boolean);
}

function minutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (iso) return Number(iso[1] || 0) * 24 * 60 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0);
  return textMinutes(value);
}

function textMinutes(value: string) {
  if (!/\d/.test(value) || value.trim() === "-") return undefined;

  const dayMatch = value.match(/(\d+)\s*j(?:our)?s?/i);
  const hourMatch = value.match(/(\d+)\s*h(?:eures?)?\s*(?:(\d+)\s*(?:min|mn)?)?/i);
  const minuteMatch = value.match(/(\d+)\s*(?:min|mn|minutes?)/i);
  const total =
    Number(dayMatch?.[1] ?? 0) * 24 * 60 +
    Number(hourMatch?.[1] ?? 0) * 60 +
    Number(hourMatch?.[2] ?? minuteMatch?.[1] ?? 0);

  if (total > 0) return total;

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
    for (const scriptBody of [script[1], decodeHtmlEntities(script[1])]) {
      try {
        const json = JSON.parse(scriptBody);
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
  }

  return null;
}

function instructionText(item: unknown): string[] {
  if (typeof item === "string") return textArray(item);
  if (!item || typeof item !== "object") return [];

  const node = item as RecipeNode;
  const nested = node.itemListElement ?? node.steps ?? node.recipeInstructions;
  if (nested) return textArray(node.text ?? node.name).concat(Array.isArray(nested) ? nested.flatMap(instructionText) : instructionText(nested));

  return textArray(node.text ?? node.name);
}

function recipeInstructions(recipe: RecipeNode) {
  return Array.isArray(recipe.recipeInstructions)
    ? recipe.recipeInstructions.flatMap(instructionText).filter(Boolean)
    : textArray(recipe.recipeInstructions);
}

function servings(value: unknown) {
  const first = textArray(value)[0];
  if (!first) return undefined;
  return Number.parseInt(first, 10) || undefined;
}

function recipeVideoUrl(recipe: RecipeNode) {
  const firstVideo = Array.isArray(recipe.video) ? recipe.video[0] : recipe.video;
  return textArray(firstVideo)[0];
}

function marmitonRestTime(html: string) {
  const text = cleanText(html);
  const match = text.match(/Repos\s*:\s*(.+?)\s+(?:Cuisson\s*:|Étape\s+1|Etape\s+1)/i);
  return match ? textMinutes(match[1]) : undefined;
}

function recipeNodeToImport(recipe: RecipeNode, url: string, html: string): ImportedRecipe {
  return {
    name: textArray(recipe.name)[0],
    sourceUrl: url,
    videoUrl: recipeVideoUrl(recipe),
    origin: findKnownRecipeOrigin(textArray(recipe.recipeCuisine)),
    tags: metadataValues(recipe),
    ingredients: textArray(recipe.recipeIngredient).map(parseIngredientLine),
    instructions: recipeInstructions(recipe),
    servings: servings(recipe.recipeYield),
    prepTime: minutes(recipe.prepTime),
    restTime: minutes(recipe.restTime ?? recipe.restingTime ?? recipe.reposTime) ?? marmitonRestTime(html),
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

    return recipeNodeToImport(recipe, url, html);
  } catch {
    return {
      sourceUrl: url,
      warnings: ["Impossible de lire ce lien pour le moment. Le lien est gardé pour une saisie manuelle."],
    };
  }
}
