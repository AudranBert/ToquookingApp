import type { ParsedRecipe } from "../types";
import { cleanText } from "./text";
import { absolutizeUrl } from "./images";
import { parseIngredientLine } from "../utils/ingredients";

export function defaultMarkdownFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const explicitTitle = normalized.match(/^\s*Title:\s*(.+)$/im)?.[1];
  const headingTitle = lines.find((line) => /^#\s+/.test(line.trim()))?.replace(/^#\s+/, "");
  const firstContentLine = lines.find((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(trimmed)) return false;
    if (/^[-*+]\s+/.test(trimmed)) return false;
    return true;
  });
  const title = cleanText(explicitTitle ?? headingTitle ?? firstContentLine ?? "");

  const ingredientHeader = /^(?:#{1,6}\s*)?(?:les\s+)?(?:ingredients?|ingr\S*dients?)(?:\s+(?:pour|for)\s+.+)?\s*:?\s*$/i;
  const instructionHeader =
    /^(?:#{1,6}\s*)?(?:(?:les\s+)?[eé]tapes?\s+de\s+)?(?:instructions?|steps?|directions?|pr\S*paration|method)(?:\s+(?:de la recette|of the recipe))?\s*:?\s*$/i;
  const nextSectionHeader = /^\s{0,3}#{1,6}\s+\S+/;
  const bulletLine = /^\s*(?:[-*+]|(?:\d+[.)]))\s+(.+)$/;
  const stopSection =
    /(partagez vos photos|une question|commentaire|suivre les commentaires|recette partagee|essayez aussi|plan du site|flux rss|google-analytics)/i;
  const noiseLine =
    /(^(URL Source|Published Time|Markdown Content|Image)\s*:|<input|<textarea|<\/?\w+|formulaire_action|jQuery|autosave|_gaq|^\|$|^-->|^\/><input|required=|class=|accept=)/i;

  const isNoise = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (noiseLine.test(trimmed)) return true;
    if (trimmed.length < 2) return true;
    return false;
  };

  const splitIngredientLine = (value: string) => {
    const cleaned = cleanText(value);
    if (!cleaned) return [];
    if (cleaned.length < 90) return [cleaned];
    return cleaned
      .split(/\s+(?=(?:\d+|½|¼|¾|un|une)\s)/i)
      .map((part) => cleanText(part))
      .filter(Boolean);
  };

  const collectSection = (headerMatcher: RegExp) => {
    const start = lines.findIndex((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(trimmed)) return false;
      return headerMatcher.test(trimmed);
    });
    if (start < 0) return [] as string[];
    const values: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      if (stopSection.test(trimmed)) break;
      if (ingredientHeader.test(trimmed) || instructionHeader.test(trimmed) || /^(?:#{1,6}\s*)?(?:notes?|source|vid[eé]o|nutrition)\s*:/i.test(trimmed)) break;
      if (nextSectionHeader.test(trimmed) && values.length > 0) break;
      const bullet = line.match(bulletLine);
      const raw = bullet ? bullet[1] : trimmed;
      const cleaned = cleanText(raw);
      if (isNoise(cleaned)) continue;
      values.push(cleaned);
    }
    return values;
  };

  const ingredientLines = collectSection(ingredientHeader).flatMap(splitIngredientLine);
  const instructionLines = collectSection(instructionHeader).filter((line) => {
    if (isNoise(line)) return false;
    if (/^(ingredients?|ingr\S*dients?|preparation|instructions?)\b/i.test(line)) return false;
    return true;
  });
  const markdownImage = normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i)?.[1];
  const imageLabelLine =
    normalized.match(/^\s*Image\s*:\s*(https?:\/\/\S+)\s*$/im)?.[1] ??
    normalized.match(/^\s*Image\s*:\s*(\/\/\S+)\s*$/im)?.[1];
  const ogImage =
    normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    normalized.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  const firstHtmlImage = normalized.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const imageUrl = absolutizeUrl(
    markdownImage ?? imageLabelLine ?? ogImage ?? firstHtmlImage,
    sourceUrl
  );

  if (ingredientLines.length === 0 && instructionLines.length === 0) return null;

  return {
    sourceUrl,
    name: title || undefined,
    servings: Number(normalized.match(/(?:pour\s+)?(\d+)\s*(?:personnes?|portions?|servings?)\b/i)?.[1]) || undefined,
    imageUrl,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions: instructionLines,
    warnings: [
      "Import partiel depuis contenu non structuré. Vérifie ingrédients, étapes et quantités avant de sauvegarder.",
    ],
  };
}

export function markdownSectionExtractor(
  content: string,
  sourceUrl: string,
  sectionLabels: { ingredients: RegExp; instructions: RegExp; stop?: RegExp }
): ParsedRecipe | null {
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

  const ingStart = lines.findIndex((line) => sectionLabels.ingredients.test(line));
  // The preparation-time label above the recipe is not the instructions section.
  const prepStart = lines.findIndex((line, index) => index > ingStart && sectionLabels.instructions.test(line));
  const prepHeadingLevel = prepStart >= 0 ? lines[prepStart].match(/^(#+)\s/)?.[1].length : undefined;
  const stop =
    sectionLabels.stop ??
    /(vous aimerez aussi|commentaires?|newsletter|partage|a lire aussi|publicit[eé]|ustensiles)/i;

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  if (ingStart >= 0) {
    const end = prepStart > ingStart ? prepStart : lines.length;
    for (let i = ingStart + 1; i < end; i += 1) {
      const line = lines[i];
      if (!line || stop.test(line)) break;
      if (/^#{1,6}\s+/.test(line)) break;
      if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
      if (/^(?:\d+\s*pers\.?|[*•-]\s*ingr\S*dients?)\s*$/i.test(line)) continue;
      if (/^(temps|pr[eé]paration|cuisson|repos)\s*:/i.test(line)) continue;
      if (/^[*•\-]$|^\d+\/\d+$/.test(line)) continue;
      if (!/[a-zA-ZÀ-ÿ]/.test(line)) continue;
      ingredients.push(parseIngredientLine(line.replace(/^[*•\-]\s*/, "")));
    }
  }

  const instructions: string[] = [];
  if (prepStart >= 0) {
    for (let i = prepStart + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (stop.test(line)) break;
      const headingLevel = line.match(/^(#+)\s/)?.[1].length;
      if (headingLevel && prepHeadingLevel && headingLevel <= prepHeadingLevel) break;
      if (headingLevel) continue;
      if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
      if (/^(temps total|pr[eé]paration\s*:|repos\s*:|cuisson\s*:)/i.test(line)) continue;
      if (/^[eé]tape\s*\d+/i.test(line)) continue;
      if (/^\*+$|^\|$|^[*•-]?\s*\d+\s*:\s*$/.test(line)) continue;
      instructions.push(line.replace(/^\d+[.)]\s*/, ""));
    }
  }

  const imageFromMd = normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/i)?.[1];
  const ogImage = normalized.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  )?.[1];
  const imageUrl = absolutizeUrl(imageFromMd ?? ogImage, sourceUrl);

  if (ingredients.length === 0 && instructions.length === 0) return null;
  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    warnings: [
      "Import partiel depuis contenu non structuré. Vérifie ingrédients, étapes et quantités avant de sauvegarder.",
    ],
  };
}
