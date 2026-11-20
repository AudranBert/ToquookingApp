import type { ParsedRecipe } from "../../types";
import { cleanText } from "../text";
import { parseIngredientLine } from "../../utils/ingredients";
import { absolutizeUrl } from "../images";
import { parseDurationText } from "../metadata";

export function papillesEtPupillesFallback(
  content: string,
  sourceUrl: string
): ParsedRecipe | null {
  if (!/papillesetpupilles\.fr/i.test(sourceUrl)) return null;
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
  const title = cleanText(
    normalized.match(/^\s*Title:\s*(.+)$/im)?.[1] ??
      lines.find(
        (line) => !/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(line)
      ) ??
      ""
  );
  if (/^just a moment/i.test(title) || /cloudflare|attention required/i.test(normalized))
    return null;
  const ingStart = lines.findIndex((line) => /^(?:#{1,6}\s*)?ingr\S*dients?\s*:?$/i.test(line));
  const prepStart = lines.findIndex((line) => /^(?:#{1,6}\s*)?pr\S*paration\s*:?$/i.test(line));
  const stop = /(questions|pourquoi j'aime|r[ée]dig[ée] par|tags\s*:|newsletter|commentaires?)/i;

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  if (ingStart >= 0) {
    const end = prepStart > ingStart ? prepStart : lines.length;
    for (let i = ingStart + 1; i < end; i += 1) {
      const line = lines[i];
      if (!line || stop.test(line)) break;
      if (/^pour\s+\d+/i.test(line)) continue;
      if (!/^[*•-]\s+/.test(line)) continue;
      const item = cleanText(line.replace(/^[*•-]\s+/, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
      if (
        !item ||
        /recettes par ingr|produits de saison|a la decouverte|mieux connaitre/i.test(item)
      )
        continue;
      ingredients.push(parseIngredientLine(item));
    }
  }

  const instructions: string[] = [];
  if (prepStart >= 0) {
    for (let i = prepStart + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (/^#{1,6}\s+/.test(line)) break;
      if (stop.test(line)) break;
      if (/^image\s*:|^!?\[.*image|^pour\s+\d+|^>/i.test(line)) continue;
      if (line.length < 12) continue;
      instructions.push(line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
    }
  }

  const imageUrl = absolutizeUrl(
    normalized.match(/https?:\/\/[^\s"'()]*\/wp-content\/uploads\/[^\s"'()]+/i)?.[0] ??
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    sourceUrl
  );

  if (ingredients.length === 0 && instructions.length === 0) return null;
  return {
    sourceUrl,
    name: title || undefined,
    servings: Number(normalized.match(/pour\s+(\d+)\s+personnes?/i)?.[1]) || undefined,
    prepTime: parseDurationText(normalized.match(/Temps de pr\S*paration\s*:\s*([^\n-]+)/i)?.[1] ?? ""),
    cookTime: parseDurationText(normalized.match(/Temps de cuisson\s*:\s*([^\n-]+)/i)?.[1] ?? ""),
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    warnings: [
      "Import partiel depuis contenu non structuré. Vérifie ingrédients, étapes et quantités avant de sauvegarder.",
    ],
  };
}
