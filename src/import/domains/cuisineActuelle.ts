import type { ParsedRecipe } from "../../types";
import { markdownSectionExtractor } from "../markdown";

export function cuisineActuelleFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisineactuelle\.fr/i.test(sourceUrl)) return null;
  return markdownSectionExtractor(content, sourceUrl, {
    ingredients: /ingr\S*dients?/i,
    instructions: /(pr\S*paration|etapes?|instructions?)/i,
    stop: /(vous aimerez aussi|commentaires?|newsletter|publicit[eé])/i,
  });
}
