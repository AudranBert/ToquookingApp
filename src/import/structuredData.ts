import type { ParsedRecipe } from "../types";
import {
  arrayify,
  instructionText,
  metadataValues,
  parseDurationToMinutes,
  recipeVideoUrl,
  servings,
} from "./metadata";
import { findKnownRecipeOrigin } from "../origins";
import { parseIngredientLine } from "../utils/ingredients";
import { absolutizeUrl } from "./images";
import { cleanText } from "./text";

export function extractRecipeFromJsonLd(json: unknown, sourceUrl: string): ParsedRecipe | null {
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
    restTime: parseDurationToMinutes(recipe.restTime ?? recipe.restingTime ?? recipe.reposTime),
    cookTime: parseDurationToMinutes(recipe.cookTime),
    totalTime: parseDurationToMinutes(recipe.totalTime),
    imageUrl: absolutizeUrl(images[0], sourceUrl),
    videoUrl: absolutizeUrl(recipeVideoUrl(recipe), sourceUrl),
  };
}

export function extractRecipeFromMrtnRecipesData(
  html: string,
  sourceUrl: string
): ParsedRecipe | null {
  const match = html.match(/Mrtn\.recipesData\s*=\s*(\{[\s\S]*?\});/i);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]) as { recipes?: Array<Record<string, unknown>> };
    const recipe = parsed.recipes?.[0];
    if (!recipe) return null;

    const ingredientsRaw = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const ingredients = ingredientsRaw
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const row = item as Record<string, unknown>;
        const qty = row.qty == null ? "" : String(row.qty);
        const unit = row.unit == null ? "" : String(row.unit);
        const name = row.name == null ? "" : String(row.name);
        return cleanText(`${qty} ${unit} ${name}`);
      })
      .filter(Boolean)
      .map(parseIngredientLine);

    const servingsValue =
      recipe.nb_pers == null ? undefined : Number.parseInt(String(recipe.nb_pers), 10) || undefined;
    const imageUrl = absolutizeUrl(cleanText(String(recipe.picture_url ?? "")), sourceUrl);
    const name = cleanText(String(recipe.name ?? ""));

    if (!name && ingredients.length === 0) return null;

    return {
      sourceUrl,
      name: name || undefined,
      imageUrl: imageUrl || undefined,
      ingredients: ingredients.length ? ingredients : undefined,
      servings: servingsValue,
    };
  } catch {
    return null;
  }
}

export function extractRecipeFromMicrodataHtml(
  html: string,
  sourceUrl: string
): ParsedRecipe | null {
  const normalized = html.replace(/\r\n/g, "\n");
  const block =
    normalized.match(
      /<article[^>]+itemtype=["'][^"']*schema\.org\/Recipe[^"']*["'][^>]*>([\s\S]*?)<\/article>/i
    )?.[1] ?? normalized;

  const name =
    cleanText(block.match(/itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    cleanText(
      block.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    );

  const ingredientMatches = [
    ...block.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/li>/gi),
  ];
  const ingredients = ingredientMatches
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .map(parseIngredientLine);

  const instructionContainer =
    block.match(
      /itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i
    )?.[1] ?? "";
  const instructionItems = [
    ...instructionContainer.matchAll(/<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi),
  ]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
  const instructions = instructionItems.length
    ? instructionItems
    : cleanText(instructionContainer)
        .split(/\.(?:\s+|$)|\n+/)
        .map((line) => cleanText(line))
        .filter((line) => line.length > 8);

  const servings = Number.parseInt(
    cleanText(
      block.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
        block.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        ""
    ),
    10
  );

  const prepTime = parseDurationToMinutes(
    block.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
  const cookTime = parseDurationToMinutes(
    block.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
  const totalTime = parseDurationToMinutes(
    block.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );

  const imageCandidates = [
    block.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    block.match(/itemprop=["']image["'][^>]+src=["']([^"']+)["']/i)?.[1],
    block.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1],
  ].filter(Boolean) as string[];
  const imageUrl = absolutizeUrl(imageCandidates[0], sourceUrl);

  if (ingredients.length === 0 && instructions.length === 0) return null;

  return {
    sourceUrl,
    name: name || undefined,
    ingredients,
    instructions,
    servings: Number.isFinite(servings) && servings > 0 ? servings : undefined,
    prepTime,
    cookTime,
    totalTime,
    imageUrl,
  };
}
