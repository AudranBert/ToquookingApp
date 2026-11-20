import type { ParsedRecipe } from "../../types";
import { extractRecipeFromJsonLd, extractRecipeFromMicrodataHtml } from "../structuredData";
import { parseDurationText, parseDurationToMinutes, servings } from "../metadata";
import { cleanText, decodeHtmlEntities, isInstructionNoise } from "../text";
import { absolutizeUrl, pickBestImageCandidate } from "../images";
import { parseIngredientLine } from "../../utils/ingredients";

export function cuisineLibreFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisine-libre\.org/i.test(sourceUrl)) return null;

  // Dedicated structured path for cuisine-libre pages (preferred over text heuristics).
  const structured = extractRecipeFromMicrodataHtml(content, sourceUrl);
  if (
    structured &&
    (structured.ingredients?.length ?? 0) > 0 &&
    (structured.instructions?.length ?? 0) > 0
  ) {
    const normalized = content.replace(/\r\n/g, "\n");
    const prepTime =
      structured.prepTime ??
      parseDurationToMinutes(
        normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
      );
    const cookTime =
      structured.cookTime ??
      parseDurationToMinutes(
        normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
      );
    const totalTime =
      structured.totalTime ??
      parseDurationToMinutes(
        normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
      );
    const servingsValue =
      structured.servings ??
      servings(
        cleanText(
          normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
            normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
            ""
        )
      );
    const imageUrl = pickBestImageCandidate(
      [
        structured.imageUrl,
        normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
        normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
        normalized.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1],
      ],
      sourceUrl
    );

    return {
      ...structured,
      sourceUrl,
      imageUrl: imageUrl ?? structured.imageUrl,
      servings: servingsValue ?? structured.servings,
      prepTime,
      cookTime,
      totalTime,
      warnings: undefined,
    };
  }

  const normalized = content.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
  const lines = rawLines.map((line) => cleanText(line)).filter(Boolean);

  const title = cleanText(
    normalized.match(/^\s*Title:\s*(.+)$/im)?.[1] ??
      lines.find(
        (line) => !/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(line)
      ) ??
      ""
  );

  const ingredientStart = rawLines.findIndex(
    (line) => /ingr\S*dients?\s+pour/i.test(cleanText(line)) || /^#+\s*ingr\S*dients?\b/i.test(line)
  );
  const prepStart = rawLines.findIndex(
    (line) => /^#+\s*pr\S*paration\b/i.test(line) || /^pr\S*paration\b/i.test(cleanText(line))
  );
  const endMarkers =
    /(recette partagee|partagez vos photos|une question|commentaire|suivre les commentaires|plan du site|essayer aussi|flux rss)/i;

  const ingredientLines: string[] = [];
  if (ingredientStart >= 0) {
    const stop = prepStart > ingredientStart ? prepStart : rawLines.length;
    for (let i = ingredientStart + 1; i < stop; i += 1) {
      const raw = rawLines[i].trim();
      if (!raw) continue;
      if (/^#+\s+/.test(raw)) break;
      const bullet = raw.match(/^\s*[*-]\s+(.+)$/);
      if (!bullet) continue;
      const item = cleanText(bullet[1]);
      if (!item || item === "*" || /^#+/.test(item)) continue;
      ingredientLines.push(item);
    }
  }

  const instructions: string[] = [];
  if (prepStart >= 0) {
    for (let i = prepStart + 1; i < rawLines.length; i += 1) {
      const raw = rawLines[i].trim();
      const cleaned = cleanText(raw);
      if (!cleaned) continue;
      if (endMarkers.test(cleaned)) break;
      if (/^#+\s+/.test(raw) && !/^#+\s*(preparation|pr\S*parer)/i.test(raw)) break;
      if (/<|>|jQuery|formulaire_action|autosave|_gaq|^\*+$|^\|$/.test(cleaned)) continue;
      const numbered = cleaned.match(/^\d+[.)]\s*(.+)$/);
      if (numbered) {
        const step = cleanText(numbered[1]);
        if (step) instructions.push(step);
        continue;
      }
      if (/^pour\s+/i.test(cleaned)) continue;
      if (instructions.length === 0 && cleaned.length > 20) {
        instructions.push(cleaned);
        continue;
      }
      if (instructions.length === 0) continue;
      instructions[instructions.length - 1] =
        `${instructions[instructions.length - 1]} ${cleaned}`.trim();
    }
  }

  if (prepStart >= 0 && instructions.length === 0) {
    for (let i = prepStart + 1; i < rawLines.length; i += 1) {
      const cleaned = cleanText(rawLines[i]);
      if (!cleaned) continue;
      if (endMarkers.test(cleaned)) break;
      if (/<|>|jQuery|formulaire_action|autosave|_gaq|^\*+$|^\|$/.test(cleaned)) continue;
      if (/^(temps total|pr\S*paration\s*:|repos\s*:|cuisson\s*:|mijot|sans )/i.test(cleaned))
        continue;
      if (/^ingr\S*dients?/i.test(cleaned)) continue;
      if (cleaned.length < 12) continue;
      instructions.push(cleaned.replace(/^\d+[.)]\s*/, ""));
    }
  }

  if (instructions.length === 0) {
    const htmlSteps = [...normalized.matchAll(/<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter((line) => line.length > 20)
      .filter((line) => !isInstructionNoise(line))
      .filter(
        (line) => !/^(ingr\S*dients?|préparation|preparation|temps|cuisson|repos)\b/i.test(line)
      )
      .filter((line) => /[a-zà-ÿ]/i.test(line));
    for (const line of htmlSteps) {
      if (instructions.includes(line)) continue;
      instructions.push(line.replace(/^\d+[.)]\s*/, ""));
      if (instructions.length >= 12) break;
    }
  }

  if (instructions.length === 0) {
    const numberedSteps = [...normalized.matchAll(/(?:^|\n)\s*\d+[.)]\s+([^\n]+)/g)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter((line) => line.length > 20)
      .filter((line) => !isInstructionNoise(line))
      .filter(
        (line) => !/^(ingr\S*dients?|préparation|preparation|temps|cuisson|repos)\b/i.test(line)
      );
    for (const step of numberedSteps) {
      if (instructions.includes(step)) continue;
      instructions.push(step);
      if (instructions.length >= 12) break;
    }
  }

  if (instructions.length === 0) {
    const jsonLdScripts = [
      ...normalized.matchAll(
        /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi
      ),
    ];
    for (const match of jsonLdScripts) {
      for (const body of [match[1], decodeHtmlEntities(match[1])]) {
        try {
          const parsed = extractRecipeFromJsonLd(JSON.parse(body), sourceUrl);
          if (!parsed?.instructions?.length) continue;
          for (const step of parsed.instructions) {
            const cleaned = cleanText(step);
            if (!cleaned || isInstructionNoise(cleaned)) continue;
            if (!instructions.includes(cleaned)) instructions.push(cleaned);
          }
        } catch {
          // Ignore invalid JSON-LD.
        }
      }
      if (instructions.length > 0) break;
    }
  }

  const servingsText =
    cleanText(normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]) ||
    cleanText(normalized.match(/Ingr\S*dients?\s+[^<\n]*pour\s+([^<\n]+)/i)?.[1]);
  const servingsValue = servings(servingsText);

  const prepTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ??
    parseDurationText(cleanText(normalized.match(/Pr\S*paration\s*:\s*([^<\n]+)/i)?.[1] ?? ""));
  const cookTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ?? parseDurationText(cleanText(normalized.match(/Cuisson\s*:\s*([^<\n]+)/i)?.[1] ?? ""));
  const totalTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ??
    parseDurationText(cleanText(normalized.match(/Dur\S*e\s+totale\s*:\s*([^<\n]+)/i)?.[1] ?? ""));

  const markdownImages = [
    ...normalized.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/gi),
  ].map((m) => m[1]);
  const cacheImage =
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-vignettes\/[^\s"'()]+/i)?.[0] ??
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-gd2\/[^\s"'()]+/i)?.[0];
  const preferredMarkdownImage = markdownImages.find((url) =>
    /\/local\/cache-vignettes\//i.test(url)
  );
  const genericMetaImage = normalized.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  )?.[1];
  const twitterImage = normalized.match(
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
  )?.[1];
  const imageSrc = normalized.match(
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  )?.[1];
  const imageCandidate =
    preferredMarkdownImage ??
    cacheImage ??
    genericMetaImage ??
    twitterImage ??
    imageSrc ??
    markdownImages[0];
  const imageUrl = absolutizeUrl(imageCandidate, sourceUrl);

  if (ingredientLines.length === 0 && instructions.length === 0) return null;

  // Guardrails against noisy crawler/plain-text variants.
  const noisyInstructionHit = instructions.some((line) =>
    /(value=|formulaire_action|jQuery|autosave|_gaq|Rated \d+\.\d+ out of 5|Adresse [ée]lectronique|Votre pseudo)/i.test(
      line
    )
  );
  if (ingredientLines.length > 25 || noisyInstructionHit) {
    return null;
  }

  const cappedInstructions = instructions.slice(0, 20);

  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    servings: servingsValue,
    prepTime,
    cookTime,
    totalTime,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions: cappedInstructions,
    warnings: [
      "Import partiel depuis contenu non structuré. Vérifie ingrédients, étapes et quantités avant de sauvegarder.",
    ],
  };
}
