import { cleanText, isImageMarkdownLine, isInstructionNoise } from "../text";
import { parseDurationText, parseDurationToMinutes, servings } from "../metadata";
import type { ParsedRecipe } from "../../types";
import { pickBestImageCandidate } from "../images";
import { parseIngredientLine } from "../../utils/ingredients";

export function marmitonRestTime(html: string) {
  const text = cleanText(html);
  const match = text.match(/Repos\s*:\s*(.+?)\s+(?:Cuisson\s*:|Étape\s+1|Etape\s+1)/i);
  return match ? parseDurationText(match[1]) : undefined;
}

export function extractMarmitonCarouselImageCandidates(html: string) {
  const urls: string[] = [];
  const push = (value?: string) => {
    if (!value) return;
    const cleaned = cleanText(value);
    if (!cleaned) return;
    if (!/^https?:\/\/|^\/\//i.test(cleaned)) return;
    if (!/assets\.afcdn\.com\/recipe\//i.test(cleaned)) return;
    urls.push(cleaned);
  };

  const imgBlocks = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  for (const block of imgBlocks) {
    push(block.match(/\bsrc=["']([^"']+)["']/i)?.[1]);
    push(block.match(/\bdata-src=["']([^"']+)["']/i)?.[1]);
    push(block.match(/\bdata-original=["']([^"']+)["']/i)?.[1]);
    push(block.match(/\bdata-lazy(?:-src)?=["']([^"']+)["']/i)?.[1]);

    const srcset =
      block.match(/\bsrcset=["']([^"']+)["']/i)?.[1] ??
      block.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1];
    if (srcset) {
      for (const part of srcset.split(",")) {
        const src = cleanText(part).split(/\s+/)[0];
        push(src);
      }
    }
  }

  // Marmiton embeds the diapo images in a JS payload:
  // af_diapo_list.push({ photos:[[id,"..._w600.jpg",...], ...] })
  // Prioritize these, they are the recipe carousel images.
  const diapoPhotosMatch = html.match(
    /af_diapo_list\.push\(\{[\s\S]*?photos\s*:\s*\[([\s\S]*?)\]\s*,\s*sButtons/i
  );
  if (diapoPhotosMatch?.[1]) {
    for (const match of diapoPhotosMatch[1].matchAll(
      /https?:\/\/assets\.afcdn\.com\/recipe\/[^"'\\\s,)\]]+_w(?:600|648|1024)[^"'\\\s,)\]]*/gi
    )) {
      push(match[0]);
    }
  }

  const deduped = Array.from(new Set(urls));
  return deduped.filter(
    (url) => !/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)
  );
}

export function marmitonFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (
    !/marmiton/i.test(sourceUrl) &&
    !/card-ingredient|recipe-preparation|ingr\S*dients|[eé]tape/i.test(content)
  )
    return null;

  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
  const title =
    cleanText(normalized.match(/^\s*Title:\s*(.+)$/im)?.[1]) ||
    cleanText(normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
    cleanText(
      normalized.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    );

  const servingsValue =
    servings(
      cleanText(
        normalized.match(/(\d+)\s*personnes?/i)?.[0] ??
          normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
          ""
      )
    ) ?? undefined;

  const prepTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ??
    parseDurationText(cleanText(normalized.match(/Pr\S*paration\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const cookTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ?? parseDurationText(cleanText(normalized.match(/Cuisson\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const totalTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ??
    parseDurationText(cleanText(normalized.match(/Temps\s+total\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const restTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']restTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ?? marmitonRestTime(normalized);
  const carouselImages = extractMarmitonCarouselImageCandidates(normalized);

  const imageUrl = pickBestImageCandidate(
    [
      ...carouselImages,
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(/^\s*Image\s*:\s*(https?:\/\/\S+)\s*$/im)?.[1],
      normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/i)?.[1],
      normalized.match(
        /<img[^>]+src=["']([^"']+recette[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i
      )?.[1],
      normalized.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:recipe|recette|food|dish)/i)?.[1],
    ],
    sourceUrl
  );

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  let qty = "";
  let unit = "";
  let name = "";
  let complement = "";

  const flushIngredient = () => {
    const assembled = [qty, unit, name, complement]
      .map((v) => cleanText(v))
      .filter(Boolean)
      .join(" ");
    if (!assembled || /^data-|^https?:\/\//i.test(assembled)) return;
    ingredients.push(parseIngredientLine(assembled));
    qty = "";
    unit = "";
    name = "";
    complement = "";
  };

  for (const line of lines) {
    const quantity = line.match(/data-ingredientQuantity="([^"]*)/i)?.[1];
    if (quantity != null) qty = cleanText(quantity);

    const parsedUnit = line.match(/data-unit(?:Singular|Plural)="([^"]*)/i)?.[1];
    if (parsedUnit != null) unit = cleanText(parsedUnit);

    const parsedName = line.match(/data-ingredientName(?:Singular|Plural)="([^"]*)/i)?.[1];
    if (parsedName != null) name = cleanText(parsedName);

    const parsedComplement = line.match(
      /data-ingredientComplement(?:Singular|Plural)="([^"]*)/i
    )?.[1];
    if (parsedComplement != null) complement = cleanText(parsedComplement);

    if (name) flushIngredient();
  }

  const instructions: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^.*tape\s*\d+/i.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && /^!?\[.*image/i.test(lines[j])) j += 1;
    const stepLine = cleanText(lines[j] ?? "");
    if (!stepLine) continue;
    if (
      /^(J'ajoute mon grain de sel|Anonyme|Note de l'auteur|La recette en bref|Vous aimerez aussi)/i.test(
        stepLine
      )
    )
      break;
    if (/<|>|data-|^\W*$/.test(stepLine) || isInstructionNoise(stepLine)) continue;
    instructions.push(stepLine);
  }

  // Markdown fallback path for Marmiton (r.jina.ai output), when data-* attributes are missing.
  if (ingredients.length === 0) {
    const rawLines = normalized
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);
    const ingStart = rawLines.findIndex((line) => /ingr\S*dients/i.test(line));
    const prepStart = rawLines.findIndex((line) => /pr\S*paration/i.test(line));
    if (ingStart >= 0) {
      const stop = prepStart > ingStart ? prepStart : rawLines.length;
      for (let i = ingStart + 1; i < stop; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (/^(ustensiles|voir plus|voir moins|la suite apr|en cliquant|pr\S*paration)/i.test(line))
          break;
        if (/^!?\[.*image/i.test(line) || /^https?:\/\//i.test(line)) continue;
        if (/^personnes$/i.test(line)) continue;
        if (/<|>|^\*+$/.test(line)) continue;
        if (/^(\d+(\s+\w+)?\s+)?[a-zA-ZÀ-ÿ]/.test(line))
          ingredients.push(parseIngredientLine(line));
      }
    }
  }

  if (instructions.length === 0) {
    const rawLines = normalized
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);
    for (let i = 0; i < rawLines.length; i += 1) {
      if (!/^[eé]tape\s*\d+/i.test(rawLines[i])) continue;
      let j = i + 1;
      while (j < rawLines.length && isImageMarkdownLine(rawLines[j])) j += 1;
      const step = cleanText(rawLines[j] ?? "");
      if (!step) continue;
      if (
        /^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(
          step
        )
      )
        break;
      if (/<|>|^\*+$/.test(step)) continue;
      instructions.push(step);
    }
  }

  // Plain-text section fallback (matches what Marmiton exposes in crawl/text views).
  if (ingredients.length === 0 || instructions.length === 0) {
    const rawLines = normalized
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);
    const ingStart = rawLines.findIndex((line) => /^ingr\S*dients?$/i.test(line));
    const prepStart = rawLines.findIndex((line) => /^pr\S*paration$/i.test(line));
    const toolsStart = rawLines.findIndex((line) => /^ustensiles$/i.test(line));

    if (ingStart >= 0) {
      const stop =
        [toolsStart, prepStart].filter((x) => x > ingStart).sort((a, b) => a - b)[0] ??
        rawLines.length;
      for (let i = ingStart + 1; i < stop; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (
          /^version veggie|voir plus|voir moins|en cliquant|image[:\s]|^\[.*\]$|^\d+\/\d+$/i.test(
            line
          )
        )
          continue;
        if (/^https?:\/\//i.test(line)) continue;
        if (
          /^poivre$|^sel$/i.test(line) ||
          /^\d+\s+/.test(line) ||
          /os à moelle|bouquet garni|gousse|branches|navets|boeuf/i.test(line)
        ) {
          ingredients.push(parseIngredientLine(line));
        }
      }
    }

    if (prepStart >= 0) {
      for (let i = prepStart + 1; i < rawLines.length; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (
          /^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(
            line
          )
        )
          break;
        if (/^temps total|^pr\S*paration\s*:|^repos\s*:|^cuisson\s*:|^[eé]tape\s*\d+/i.test(line))
          continue;
        if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
        if (/<|>|^\*+$/.test(line)) continue;
        instructions.push(line);
      }
    }
  }

  const cleanedIngredients = ingredients.filter((ingredient) => {
    const line = cleanText(
      `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name ?? ""}`
    );
    if (!line) return false;
    if (/^(personnes|ustensiles|voir plus|voir moins|la suite apr|en cliquant)/i.test(line))
      return false;
    if (/^!?\[.*image/i.test(line) || /^https?:\/\//i.test(line)) return false;
    return true;
  });

  const dedupedIngredients: ReturnType<typeof parseIngredientLine>[] = [];
  const seen = new Set<string>();
  const seenByName = new Set<string>();
  const canonicalName = (value: string) =>
    cleanText(value)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\(.*?\)/g, "")
      .replace(/x$/i, "")
      .replace(/s$/i, "");
  for (const ingredient of cleanedIngredients) {
    const key = cleanText(
      `${ingredient.quantity ?? ""}|${ingredient.unit ?? ""}|${ingredient.name ?? ""}`
    ).toLowerCase();
    if (!key || seen.has(key)) continue;
    const nameKey = canonicalName(ingredient.name ?? "");
    if (nameKey && seenByName.has(nameKey)) continue;
    seen.add(key);
    if (nameKey) seenByName.add(nameKey);
    dedupedIngredients.push(ingredient);
  }

  const cleanedInstructions = instructions.filter(
    (line) =>
      line &&
      !/^!?\[.*image/i.test(line) &&
      !/^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(
        line
      )
  );

  if (dedupedIngredients.length === 0 && cleanedInstructions.length === 0) return null;
  const hasCoreFields = Boolean(
    title && servingsValue && (prepTime || cookTime || totalTime) && imageUrl
  );
  const hasStructuredEnough = Boolean(
    title && imageUrl && (dedupedIngredients.length > 0 || cleanedInstructions.length > 0)
  );

  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    servings: servingsValue,
    prepTime,
    restTime,
    cookTime,
    totalTime,
    ingredients: dedupedIngredients.length ? dedupedIngredients : undefined,
    instructions: cleanedInstructions.length ? cleanedInstructions : undefined,
    warnings:
      hasCoreFields || hasStructuredEnough
        ? undefined
        : [
            "Import partiel depuis contenu non structuré. Vérifie ingrédients, étapes et quantités avant de sauvegarder.",
          ],
  };
}

export function extractMarmitonStepsFromHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const instructions = [
    ...html.matchAll(/<div class="recipe-step-list__container"[\s\S]*?<p>([\s\S]*?)<\/p>/gi),
  ]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .filter((line) => !/�/.test(line));

  const ingredientRows = [
    ...html.matchAll(
      /data-ingredientQuantity="([^"]*)"[\s\S]*?data-unit(?:Singular|Plural)="([^"]*)"[\s\S]*?data-ingredientName(?:Singular|Plural)="([^"]*)"[\s\S]*?data-ingredientComplement(?:Singular|Plural)="([^"]*)"/gi
    ),
  ];
  const ingredients = ingredientRows
    .map((m) => cleanText(`${m[1]} ${m[2]} ${m[3]} ${m[4]}`))
    .filter(Boolean)
    .filter((line) => !/�/.test(line))
    .map(parseIngredientLine);

  const imageUrl = pickBestImageCandidate(
    [
      html.match(/id="af-diapo-desktop-0_img"[^>]*data-src="([^"]+)"/i)?.[1],
      ...extractMarmitonCarouselImageCandidates(html),
    ],
    sourceUrl
  );

  if (instructions.length === 0 && ingredients.length === 0) return null;
  return {
    sourceUrl,
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
  };
}
