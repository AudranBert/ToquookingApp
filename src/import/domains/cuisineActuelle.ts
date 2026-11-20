import type { ParsedRecipe } from "../../types";
import { markdownSectionExtractor } from "../markdown";
import { parseIngredientLine } from "../../utils/ingredients";
import { parseDurationText } from "../metadata";

export function cuisineActuelleFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisineactuelle\.fr/i.test(sourceUrl)) return null;
  const recipeStart = content.search(/^#\s+\S/m);
  const scoped = recipeStart >= 0 ? content.slice(recipeStart) : content;
  const parsed = markdownSectionExtractor(scoped, sourceUrl, {
    ingredients: /^(?:#{1,6}\s*)?(?:les\s+)?ingr\S*dients?(?:\s+pour\s+.+)?\s*:?\s*$/i,
    instructions: /^(?:#{1,6}\s*)?(?:(?:les\s+)?[eé]tapes?\s+de\s+)?(?:pr\S*paration|[eé]tapes?|instructions?)(?:\s+de la recette)?\s*:?\s*$/i,
    stop: /(vous aimerez aussi|commentaires?|newsletter|publicit[eé]|donnez-nous votre avis|questions fr[ée]quentes)/i,
  });
  if (!parsed) return null;
  const cleanMarkdown = (line: string) => line.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/cuil\.\s*à/gi, "c. à").trim();
  return {
    ...parsed,
    name: parsed.name?.replace(/^#{1,6}\s+/, ""),
    ingredients: parsed.ingredients?.map((ingredient) => {
      const line = cleanMarkdown([ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" "));
      // This site's markdown places quantities after the ingredient name.
      const trailing = line.match(/^(.+?)\s+(\d+(?:[.,/]\d+)?(?:\s*(?:kg|mg|g|cl|ml|l|tranches?|cuil\.\s*à\s*(?:soupe|caf[ée])))?)$/i);
      return parseIngredientLine(trailing && /[a-zà-ÿ]/i.test(trailing[1]) ? `${trailing[2]} ${trailing[1]}` : line);
    }).filter((ingredient) => ingredient.name && !/^ingr\S*dients?$/i.test(ingredient.name)),
    instructions: parsed.instructions?.map(cleanMarkdown),
    servings: Number(scoped.match(/(\d+)\s*pers\./i)?.[1]) || undefined,
    prepTime: parseDurationText(scoped.match(/(?:^|\n)Pr\S*paration\s+(\d+\s*(?:min|h)[^\n]*)/i)?.[1] ?? ""),
    cookTime: parseDurationText(scoped.match(/(?:^|\n)Cuisson\s+(\d+\s*(?:min|h)[^\n]*)/i)?.[1] ?? ""),
    totalTime: parseDurationText(scoped.match(/(?:^|\n)Total\s+(\d+\s*(?:min|h)[^\n]*)/i)?.[1] ?? ""),
  };
}
