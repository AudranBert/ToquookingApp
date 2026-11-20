import type { ParsedRecipe } from "../../types";
import { cleanText, isInstructionNoise } from "../text";
import { parseIngredientLine } from "../../utils/ingredients";
import { parseDurationText } from "../metadata";
import { pickBestImageCandidate } from "../images";
import { markdownSectionExtractor } from "../markdown";

export function cuisineAzFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisineaz\.com/i.test(sourceUrl)) return null;

  const normalized = content.replace(/\r\n/g, "\n");
  const title =
    cleanText(
      normalized.match(/<h1[^>]*class=["'][^"']*recipe-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ) ||
    cleanText(
      normalized.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ||
    cleanText(normalized.match(/^\s*Title:\s*(.+)$/im)?.[1]);

  const ingredients = [
    ...normalized.matchAll(/<li[^>]*class=["'][^"']*ingredient_item[^"']*["'][\s\S]*?<\/li>/gi),
  ]
    .map((match) => {
      const block = match[0];
      const label = cleanText(
        block.match(
          /<span[^>]*class=["'][^"']*ingredient_label[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
        )?.[1]
      );
      const quantity = cleanText(
        block.match(
          /<span[^>]*class=["'][^"']*ingredient_qte[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
        )?.[1]
      );
      const line = cleanText(`${quantity} ${label}`);
      return line ? parseIngredientLine(line) : null;
    })
    .filter((item): item is ReturnType<typeof parseIngredientLine> => Boolean(item));

  const instructions = [
    ...normalized.matchAll(
      /<li[^>]*class=["'][^"']*preparation_step[^"']*["'][\s\S]*?<p>([\s\S]*?)<\/p>/gi
    ),
  ]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .filter((line) => !isInstructionNoise(line));
  const cleanedInstructions = instructions.filter((line) => !isCuisineAzInstructionNoise(line));

  const servings =
    Number.parseInt(
      cleanText(
        normalized.match(
          /<p[^>]*class=["'][^"']*recipe_utils_information[^"']*["'][^>]*>\s*(\d+)\s*pers\./i
        )?.[1] ?? ""
      ),
      10
    ) || undefined;

  const prepTime = parseDurationText(
    cleanText(
      normalized.match(
        /<p[^>]*class=["'][^"']*recipe_time_information_title[^"']*["'][^>]*>\s*Pr[ée]paration\s*<\/p>[\s\S]*?<p[^>]*class=["'][^"']*recipe_time_information[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
      )?.[1] ?? ""
    )
  );
  const cookTime = parseDurationText(
    cleanText(
      normalized.match(
        /<p[^>]*class=["'][^"']*recipe_time_information_title[^"']*["'][^>]*>\s*Cuisson\s*<\/p>[\s\S]*?<p[^>]*class=["'][^"']*recipe_time_information[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
      )?.[1] ?? ""
    )
  );
  const totalTime = parseDurationText(
    cleanText(
      normalized.match(
        /<p[^>]*class=["'][^"']*recipe_time_information_title[^"']*["'][^>]*>\s*Total\s*<\/p>[\s\S]*?<p[^>]*class=["'][^"']*recipe_time_information[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
      )?.[1] ?? ""
    )
  );

  const imageUrl = pickBestImageCandidate(
    [
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(
        /<img[^>]+class=["'][^"']*ingredient_img[^"']*["'][^>]+src=["']([^"']+)["']/i
      )?.[1],
      normalized.match(
        /<img[^>]+src=["']([^"']+cuisineaz[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i
      )?.[1],
    ],
    sourceUrl
  );

  let fallbackIngredients = ingredients;
  if (fallbackIngredients.length === 0) {
    const description =
      cleanText(
        normalized.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ) ||
      cleanText(
        normalized.match(
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
        )?.[1]
      );
    const list = description.match(/ingr[ée]dients?\s+de\s+la\s+recette\s*:\s*(.+)$/i)?.[1];
    if (list) {
      fallbackIngredients = list
        .split(/,\s*/)
        .map((item) => cleanText(item))
        .filter((item) => item.length > 2)
        .slice(0, 20)
        .map((item) => parseIngredientLine(item));
    }
  }

  if (fallbackIngredients.length > 0 || cleanedInstructions.length > 0) {
    return {
      sourceUrl,
      name: title || undefined,
      imageUrl,
      ingredients: fallbackIngredients.length ? fallbackIngredients : undefined,
      instructions: cleanedInstructions.length ? cleanedInstructions : undefined,
      servings,
      prepTime,
      cookTime,
      totalTime,
      warnings: undefined,
    };
  }

  const fallback = markdownSectionExtractor(content, sourceUrl, {
    ingredients: /ingr\S*dients?/i,
    instructions: /(pr\S*paration|etapes?|instructions?)/i,
    stop: /(astuces|conseils|questions|commentaires?|a lire aussi|newsletter)/i,
  });
  if (!fallback) return null;
  if (fallback.instructions?.length) {
    fallback.instructions = fallback.instructions.filter(
      (line) => !isCuisineAzInstructionNoise(line)
    );
  }
  if ((fallback.ingredients?.length ?? 0) >= 3 && (fallback.instructions?.length ?? 0) >= 2) {
    return {
      ...fallback,
      warnings: undefined,
    };
  }
  return fallback;
}

export function isCuisineAzInstructionNoise(value: string) {
  const line = cleanText(value);
  if (!line) return true;
  if (/^(pr[ée]paration|cuisson|total|facile|enregistrer|imprimer|partager)$/i.test(line))
    return true;
  if (/^\d+\s*pers?\.?$/i.test(line)) return true;
  if (/^\d+\s*min$/i.test(line)) return true;
  if (/^\d+\s*h(?:\s*\d+\s*min)?$/i.test(line)) return true;
  if (/^le\s+\w+.*sp[ée]cialit[ée]\s+japonaise/i.test(line)) return true;
  return false;
}
