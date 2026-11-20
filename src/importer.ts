import { cleanText, decodeHtmlEntities, isInstructionNoise } from "./import/text";
import type { ParsedRecipe } from "./types";
import { hasKnownDomain, selectDomainParser } from "./import/domains/registry";
import { defaultMarkdownFallback } from "./import/markdown";
import { mergeRecipes } from "./import/merging";
import {
  extractRecipeFromJsonLd,
  extractRecipeFromMicrodataHtml,
  extractRecipeFromMrtnRecipesData,
} from "./import/structuredData";
import { absolutizeUrl, isLikelyRecipeImage, pickBestImageCandidate } from "./import/images";
import { parseDurationText, parseDurationToMinutes, servings } from "./import/metadata";
import {
  extractMarmitonCarouselImageCandidates,
  extractMarmitonStepsFromHtml,
  marmitonRestTime,
} from "./import/domains/marmiton";
import { parseIngredientLine } from "./utils/ingredients";
import { isCuisineAzInstructionNoise } from "./import/domains/cuisineAz";
import {
  fetchRecipeHtmls,
  isAcceptableMarmitonSource,
  sourceTextQualityScore,
} from "./import/fetchSources";
import {
  parseRecipeFromJsonText,
  parseRecipeFromToquePayloadText,
  parseRecipeFromToqueShareText,
} from "./import/textRecipes";

function fallbackNameFromUrl(sourceUrl: string) {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const tail = pathname.split("/").filter(Boolean).pop() ?? "";
    const raw = tail
      .replace(/^recette[_-]/i, "")
      .replace(/_[0-9]+(?:\.aspx)?$/i, "")
      .replace(/\.(aspx|html?)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!raw) return undefined;
    return raw.replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return undefined;
  }
}

function isInvalidImportedTitle(value: string | undefined, sourceUrl: string) {
  const title = cleanText(value ?? "");
  if (!title) return true;
  if (/^(?:404\b|403\b|not found\b|page introuvable\b|Cuisine Actuelle\s*:\s*toutes vos recettes)/i.test(title)) return true;
  if (/^noname$/i.test(title)) return true;
  if (/^just a moment\b/i.test(title)) return true;
  if (/attention required|cloudflare|checking your browser/i.test(title)) return true;
  if (/youtube\.com|youtu\.be/i.test(sourceUrl) && /^(subscribe|s['’]abonner)$/i.test(title))
    return true;
  return false;
}

function parseWithFallbacks(content: string, sourceUrl: string): ParsedRecipe | null {
  const domainParser = selectDomainParser(sourceUrl);
  const domainResult = domainParser?.(content, sourceUrl) ?? null;
  const defaultResult = defaultMarkdownFallback(content, sourceUrl);
  // For known domains, only trust specialized parser to avoid global parser pollution.
  if (domainParser) {
    if (/cuisine-libre\.org|papillesetpupilles\.fr/i.test(sourceUrl) && !domainResult)
      return defaultResult;
    return domainResult;
  }
  if (!domainResult) return defaultResult;
  if (!defaultResult) return domainResult;
  return mergeRecipes(domainResult, defaultResult);
}

function parseWithDomainPriority(content: string, sourceUrl: string): ParsedRecipe | null {
  const domainParser = selectDomainParser(sourceUrl);
  if (!domainParser) return null;
  const normalized = content.replace(/\r\n/g, "\n");

  const domainResult = domainParser(content, sourceUrl);
  const domainUseful = hasUsefulRecipeData(domainResult);
  let structuredResult: ParsedRecipe | null = null;
  let jsonLdImage: string | undefined;
  const jsonLdScripts = [
    ...normalized.matchAll(
      /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  for (const match of jsonLdScripts) {
    for (const body of [match[1], decodeHtmlEntities(match[1])]) {
      try {
        const parsed = extractRecipeFromJsonLd(JSON.parse(body), sourceUrl);
        if (!parsed) continue;
        structuredResult = mergeRecipes(structuredResult, parsed);
        if (!jsonLdImage && parsed.imageUrl) {
          jsonLdImage = parsed.imageUrl;
        }
      } catch {
        // ignore invalid JSON-LD snippets
      }
    }
  }

  const microdata = extractRecipeFromMicrodataHtml(normalized, sourceUrl);
  if (microdata) {
    structuredResult = mergeRecipes(structuredResult, microdata);
  }

  const name =
    cleanText(normalized.match(/^\s*Title:\s*(.+)$/im)?.[1]) ||
    cleanText(
      normalized.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ||
    cleanText(normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const imageUrl = absolutizeUrl(
    normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      jsonLdImage,
    sourceUrl
  );
  const prepTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
  const cookTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
  const totalTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
  );
  const restTime =
    parseDurationToMinutes(
      normalized.match(/itemprop=["']restTime["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ) ?? (/marmiton/i.test(sourceUrl) ? marmitonRestTime(normalized) : undefined);
  const servingsValue = servings(
    cleanText(
      normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
        normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        normalized.match(/(\d+)\s*personnes?/i)?.[0] ??
        ""
    )
  );

  // Structured recipe fields take priority over navigation and suggested recipes.
  const mergedStructured = hasUsefulRecipeData(structuredResult) ? {
    ...domainResult,
    ...structuredResult,
    ingredients: structuredResult?.ingredients?.length ? structuredResult.ingredients : domainResult?.ingredients,
    instructions: structuredResult?.instructions?.length ? structuredResult.instructions : domainResult?.instructions,
  } : domainResult;
  const enrichedDomain: ParsedRecipe = {
    ...(mergedStructured ?? domainResult ?? {}),
    sourceUrl,
    name: mergedStructured?.name ?? name ?? undefined,
    imageUrl: mergedStructured?.imageUrl ?? imageUrl ?? undefined,
    servings: mergedStructured?.servings ?? servingsValue ?? undefined,
    prepTime: mergedStructured?.prepTime ?? prepTime ?? undefined,
    restTime: mergedStructured?.restTime ?? restTime ?? undefined,
    cookTime: mergedStructured?.cookTime ?? cookTime ?? undefined,
    totalTime: mergedStructured?.totalTime ?? totalTime ?? undefined,
  };

  if (/cuisineaz\.com/i.test(sourceUrl)) {
    if ((enrichedDomain.ingredients?.length ?? 0) === 0) {
      const description =
        cleanText(
          normalized.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
        ) ||
        cleanText(
          normalized.match(
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
          )?.[1]
        );
      const listMatch = description.match(/ingr[ée]dients?\s+de\s+la\s+recette\s*:\s*(.+)$/i);
      if (listMatch?.[1]) {
        const fromMeta = listMatch[1]
          .split(/,\s*/)
          .map((item) => cleanText(item))
          .filter((item) => item.length > 2)
          .slice(0, 20)
          .map((item) => parseIngredientLine(item));
        if (fromMeta.length > 0) enrichedDomain.ingredients = fromMeta;
      }
    }

    if ((enrichedDomain.instructions?.length ?? 0) === 0) {
      const numberedSteps = [...normalized.matchAll(/(?:^|\n)\s*\d+[.)]\s+([^\n]+)/g)]
        .map((match) => cleanText(match[1]))
        .filter(Boolean)
        .filter((line) => line.length > 12)
        .filter((line) => !isCuisineAzInstructionNoise(line))
        .slice(0, 30);
      if (numberedSteps.length > 0) {
        enrichedDomain.instructions = Array.from(new Set(numberedSteps));
      }
    }

    if (!enrichedDomain.prepTime) {
      const prepText = cleanText(normalized.match(/Pr[ée]paration\s*:?\s*([0-9hmin\s]+)/i)?.[1]);
      const parsedPrep = parseDurationText(prepText);
      if (parsedPrep) enrichedDomain.prepTime = parsedPrep;
    }
    if (!enrichedDomain.cookTime) {
      const cookText = cleanText(normalized.match(/Cuisson\s*:?\s*([0-9hmin\s]+)/i)?.[1]);
      const parsedCook = parseDurationText(cookText);
      if (parsedCook) enrichedDomain.cookTime = parsedCook;
    }
    if (!enrichedDomain.totalTime) {
      const totalText = cleanText(normalized.match(/Total\s*:?\s*([0-9hmin\s]+)/i)?.[1]);
      const parsedTotal = parseDurationText(totalText);
      if (parsedTotal) enrichedDomain.totalTime = parsedTotal;
    }
    if (!enrichedDomain.servings) {
      const servingsText = cleanText(normalized.match(/(\d+)\s*pers\./i)?.[0]);
      const parsedServings = servings(servingsText);
      if (parsedServings) enrichedDomain.servings = parsedServings;
    }
  }

  if (/cuisine-libre\.org/i.test(sourceUrl) && (enrichedDomain.instructions?.length ?? 0) === 0) {
    const numberedSteps = [...normalized.matchAll(/(?:^|\n)\s*\d+[.)]\s+([^\n]+)/g)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .filter((line) => line.length > 20)
      .filter((line) => !isInstructionNoise(line))
      .filter(
        (line) => !/^(ingr\S*dients?|préparation|preparation|temps|cuisson|repos)\b/i.test(line)
      );
    if (numberedSteps.length > 0) {
      enrichedDomain.instructions = Array.from(new Set(numberedSteps)).slice(0, 20);
    }
  }

  if (hasUsefulRecipeData(structuredResult)) {
    return {
      ...enrichedDomain,
      warnings: undefined,
    };
  }

  if (domainUseful) {
    return {
      ...enrichedDomain,
      warnings: domainResult?.warnings,
    };
  }

  // Last resort only: if special importer produced no usable data, allow generic fallback.
  const defaultResult = defaultMarkdownFallback(content, sourceUrl);
  if (defaultResult) return mergeRecipes(enrichedDomain, defaultResult);
  return enrichedDomain.name ||
    enrichedDomain.imageUrl ||
    enrichedDomain.prepTime ||
    enrichedDomain.cookTime ||
    enrichedDomain.totalTime
    ? enrichedDomain
    : null;
}

function parseMarmitonStructuredOnly(html: string, sourceUrl: string): ParsedRecipe | null {
  const normalized = html.replace(/\r\n/g, "\n");
  const candidates: ParsedRecipe[] = [];

  const jsonLdScripts = [
    ...normalized.matchAll(
      /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  for (const match of jsonLdScripts) {
    for (const body of [match[1], decodeHtmlEntities(match[1])]) {
      try {
        const parsed = extractRecipeFromJsonLd(JSON.parse(body), sourceUrl);
        if (parsed) candidates.push(parsed);
      } catch {
        // ignore invalid JSON-LD snippets
      }
    }
  }

  const mrtn = extractRecipeFromMrtnRecipesData(normalized, sourceUrl);
  if (mrtn) candidates.push(mrtn);
  const stepsFromHtml = extractMarmitonStepsFromHtml(normalized, sourceUrl);
  if (stepsFromHtml) candidates.push(stepsFromHtml);

  if (candidates.length === 0) return null;
  let best: ParsedRecipe | null = null;
  for (const candidate of candidates) best = mergeRecipes(best, candidate);
  if (!best) return null;

  const carouselImages = extractMarmitonCarouselImageCandidates(normalized);
  const bestImage = pickBestImageCandidate(
    [
      ...carouselImages,
      best.imageUrl,
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    ],
    sourceUrl
  );

  return {
    ...best,
    sourceUrl,
    imageUrl: bestImage ?? best.imageUrl,
    ingredients: pickCleanestIngredients(best.ingredients),
    instructions: pickCleanestLines(best.instructions),
    warnings: undefined,
  };
}

function pickCleanestLines(lines: string[] | undefined) {
  if (!lines?.length) return lines;
  const clean = lines.filter((line) => !/�/.test(line));
  return clean.length ? clean : lines;
}

function pickCleanestIngredients(
  ingredients: ReturnType<typeof parseIngredientLine>[] | undefined
) {
  if (!ingredients?.length) return ingredients;
  const clean = ingredients.filter(
    (ing) => !/�/.test(cleanText(`${ing.quantity ?? ""} ${ing.unit ?? ""} ${ing.name ?? ""}`))
  );
  return clean.length ? clean : ingredients;
}

function extractEscapedJsonTextField(text: string, field: string) {
  const match = text.match(new RegExp(`"${field}":"([\\s\\S]*?)"`, "i"));
  if (!match?.[1]) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function parseYouTubeImport(text: string, sourceUrl: string): ParsedRecipe {
  const shortDescription = cleanText(extractEscapedJsonTextField(text, "shortDescription"));
  const titleCandidate =
    extractEscapedJsonTextField(text, "title") ||
    text.match(/^\s*Description\s*[\r\n]+([A-ZÀ-ÿ][^\r\n]{2,80})/im)?.[1] ||
    text.match(/^\s*Title:\s*(.+)$/im)?.[1] ||
    text.match(/^\s*Description\s*[\r\n]+([^\r\n]+)/im)?.[1] ||
    text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "";
  const title = cleanText(titleCandidate);

  const ingredientsBlock =
    (shortDescription || text).match(
      /ingredients?\s*:\s*([\s\S]*?)(?:\n\s*(?:cuisson|préparation|#|\b\d+\s*vues|\bPartager\b)|$)/i
    )?.[1] ??
    text.match(/Description[\s\S]*?Ingredients?\s*:\s*([\s\S]*?)(?:\n\s*Cuisson|\n\s*#|$)/i)?.[1] ??
    "";
  const safeIngredientsBlock = ingredientsBlock.length > 2500 ? "" : ingredientsBlock;
  const ingredients = safeIngredientsBlock
    .split(/\r?\n/)
    .map((line) => cleanText(line.replace(/^[-*•]\s*/, "")))
    .filter((line) => line && /[a-zA-ZÀ-ÿ]/.test(line) && line.length < 140)
    .filter(
      (line) =>
        !/(function\s+\w+\(|=>|window\.|ytInitial|player|renderer|trackingParams|commandMetadata|navigationEndpoint|\{|\}|\[|\])/i.test(
          line
        )
    )
    .map((line) => parseIngredientLine(line));

  const cuissonLine = cleanText((shortDescription || text).match(/cuisson[^\r\n.]*/i)?.[0] ?? "");
  const maybeSteps = [cuissonLine].filter((line) => line.length > 8);

  return {
    sourceUrl,
    videoUrl: sourceUrl,
    name: isInvalidImportedTitle(title, sourceUrl) ? "Recette YouTube" : title,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: maybeSteps.length ? maybeSteps : undefined,
    warnings: [
      "Import YouTube partiel : description détectée partiellement. Vérifie titre, ingrédients et étapes manuellement.",
    ],
  };
}

function sanitizeMergedResult(recipe: ParsedRecipe, sourceUrl: string): ParsedRecipe {
  const merged = { ...recipe };
  if (isInvalidImportedTitle(merged.name, sourceUrl)) {
    if (/youtube\.com|youtu\.be/i.test(sourceUrl)) {
      merged.name = "Recette YouTube";
    } else {
      merged.name = fallbackNameFromUrl(sourceUrl) ?? merged.name;
    }
  }
  if (merged.instructions?.length) {
    merged.instructions = merged.instructions.filter((line) => !isInstructionNoise(line));
  }
  if (/cuisine-libre\.org/i.test(sourceUrl) && merged.instructions?.length) {
    merged.instructions = merged.instructions.filter(
      (line) =>
        !/^(temps|cuisson\s*:|mijot|sans |rated |\d+\s+vues|partagez|imprimer|facebook|twitter|envoyer cette recette|veuillez laisser ce champ|jQuery|value=)/i.test(
          line
        )
    );
  }
  if (/cuisineactuelle\.fr/i.test(sourceUrl) && merged.ingredients?.length) {
    merged.ingredients = merged.ingredients.filter(
      (ing) => !/^ingr\S*dients?$/i.test(cleanText(ing.name ?? ""))
    );
  }
  if (/cuisineaz\.com/i.test(sourceUrl) && merged.instructions?.length) {
    merged.instructions = merged.instructions.filter(
      (line) => !isCuisineAzInstructionNoise(cleanText(line))
    );
  }
  if (hasKnownDomain(sourceUrl) && merged.instructions && merged.instructions.length > 120) {
    merged.instructions = merged.instructions.slice(0, 40);
  }
  if (hasKnownDomain(sourceUrl) && merged.ingredients && merged.ingredients.length > 60) {
    merged.ingredients = merged.ingredients.slice(0, 30);
  }
  const validImageUrls = [...(merged.imageUrls ?? []), ...(merged.sourceImageUrls ?? [])]
    .map((value) => absolutizeUrl(value, sourceUrl))
    .filter((value): value is string => Boolean(value))
    .filter((value) => isLikelyRecipeImage(value));
  if (merged.imageUrl && !isLikelyRecipeImage(merged.imageUrl) && validImageUrls[0]) {
    merged.imageUrl = validImageUrls[0];
  }
  if (merged.sourceImageUrl && !isLikelyRecipeImage(merged.sourceImageUrl) && validImageUrls[0]) {
    merged.sourceImageUrl = validImageUrls[0];
  }
  if (merged.imageUrls?.length) {
    merged.imageUrls = merged.imageUrls.filter((value) =>
      isLikelyRecipeImage(absolutizeUrl(value, sourceUrl))
    );
  }
  if (merged.sourceImageUrls?.length) {
    merged.sourceImageUrls = merged.sourceImageUrls.filter((value) =>
      isLikelyRecipeImage(absolutizeUrl(value, sourceUrl))
    );
  }
  return merged;
}

function finalizeRecipe(
  sourceUrl: string,
  structured: ParsedRecipe | null,
  fallback: ParsedRecipe | null
): ParsedRecipe | null {
  const structuredUseful = hasUsefulRecipeData(structured);
  if (structuredUseful && structured) {
    const resolvedName =
      structured.name && !/^noname$/i.test(structured.name.trim())
        ? structured.name
        : fallbackNameFromUrl(sourceUrl);
    return {
      ...structured,
      name: resolvedName ?? structured.name,
      imageUrl: structured.imageUrl ?? fallback?.imageUrl,
      sourceUrl: structured.sourceUrl ?? sourceUrl,
      warnings: structured.warnings,
    };
  }
  if (fallback) return fallback;
  return structured;
}

function hasUsefulRecipeData(recipe: ParsedRecipe | null | undefined) {
  if (!recipe) return false;
  return (recipe.ingredients?.length ?? 0) > 0 || (recipe.instructions?.length ?? 0) > 0;
}

export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  try {
    const htmlSourcesRaw = await fetchRecipeHtmls(url);
    const isMarmiton = /(^https?:\/\/)?([^/]+\.)?marmiton\.org\//i.test(url);
    const htmlSources = (
      isMarmiton ? htmlSourcesRaw.filter(isAcceptableMarmitonSource) : htmlSourcesRaw
    ).sort((a, b) => sourceTextQualityScore(b) - sourceTextQualityScore(a));
    const effectiveSources = htmlSources.length > 0 ? htmlSources : htmlSourcesRaw;
    const hasDedicatedDomainParser = hasKnownDomain(url);
    let merged: ParsedRecipe | null = null;
    let structuredMerged: ParsedRecipe | null = null;
    let fallbackMerged: ParsedRecipe | null = null;

    if (/youtube\.com|youtu\.be/.test(url)) {
      return parseYouTubeImport(htmlSources.join("\n"), url);
    }

    if (isMarmiton) {
      let strictMarmiton: ParsedRecipe | null = null;
      for (const html of effectiveSources) {
        const structured = parseMarmitonStructuredOnly(html, url);
        if (structured) strictMarmiton = mergeRecipes(strictMarmiton, structured);
      }
      if (strictMarmiton && hasUsefulRecipeData(strictMarmiton)) {
        return sanitizeMergedResult(strictMarmiton, url);
      }
    }

    for (const html of effectiveSources) {
      if (hasDedicatedDomainParser) {
        const domainPriority = parseWithDomainPriority(html, url);
        if (domainPriority) {
          structuredMerged = mergeRecipes(structuredMerged, domainPriority);
        }
        continue;
      }

      const jsonLdScripts = [
        ...html.matchAll(
          /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi
        ),
      ];
      for (const match of jsonLdScripts) {
        for (const scriptBody of [match[1], decodeHtmlEntities(match[1])]) {
          try {
            const parsed = extractRecipeFromJsonLd(JSON.parse(scriptBody), url);
            if (!parsed) continue;
            const enriched = {
              ...parsed,
              restTime: parsed.restTime ?? marmitonRestTime(html),
              sourceUrl: url,
              warnings: parsed.name?.trim()
                ? undefined
                : ["Nom non détecté automatiquement. Renseigne le titre manuellement."],
            };
            structuredMerged = mergeRecipes(structuredMerged, enriched);
          } catch {
            continue;
          }
        }
      }

      const microdata = extractRecipeFromMicrodataHtml(html, url);
      if (microdata) {
        structuredMerged = mergeRecipes(structuredMerged, microdata);
      }

      const markdownFallback = parseWithFallbacks(html, url);
      if (markdownFallback) {
        fallbackMerged = mergeRecipes(fallbackMerged, markdownFallback);
      }
    }

    const finalized = finalizeRecipe(url, structuredMerged, fallbackMerged);
    if (finalized) {
      merged = mergeRecipes(merged, finalized);
    }

    if (merged && hasUsefulRecipeData(merged) && !isInvalidImportedTitle(merged.name ?? fallbackNameFromUrl(url), url)) {
      return sanitizeMergedResult(merged, url);
    }
  } catch {
    return {
      sourceUrl: url,
      warnings: [
        "Import automatique indisponible pour ce site pour le moment. Le lien est conservé, complète la recette manuellement.",
      ],
    };
  }

  return {
    sourceUrl: url,
    warnings: [
      "Aucune recette exploitable détectée sur cette page. Le lien est conservé, complète les champs manquants.",
    ],
  };
}

export function importRecipeFromText(text: string): ParsedRecipe {
  const content = text.trim();
  if (!content) {
    return {
      warnings: ["Colle un texte de recette pour lancer l'import."],
    };
  }

  const sourceUrl =
    content.match(/https?:\/\/[^\s)]+/i)?.[0]?.trim() ||
    content.match(/www\.[^\s)]+/i)?.[0]?.trim();
  const normalizedSourceUrl = sourceUrl
    ? /^https?:\/\//i.test(sourceUrl)
      ? sourceUrl
      : `https://${sourceUrl}`
    : undefined;
  const explicitSourceLine = content.match(/^\s*source\s*:\s*(https?:\/\/\S+)/im)?.[1]?.trim();
  const recipeSourceUrl = explicitSourceLine || normalizedSourceUrl;
  const parserBaseUrl = recipeSourceUrl || "https://import.local/text";

  const sharedPayloadRecipe = parseRecipeFromToquePayloadText(content);
  if (sharedPayloadRecipe) {
    return sanitizeMergedResult(
      {
        ...sharedPayloadRecipe,
        sourceUrl: sharedPayloadRecipe.sourceUrl ?? recipeSourceUrl,
      },
      sharedPayloadRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl
    );
  }

  const structuredShareRecipe = parseRecipeFromToqueShareText(content);
  if (structuredShareRecipe) {
    return sanitizeMergedResult(
      {
        ...structuredShareRecipe,
        sourceUrl: structuredShareRecipe.sourceUrl ?? recipeSourceUrl,
      },
      structuredShareRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl
    );
  }

  const jsonRecipe = parseRecipeFromJsonText(content);
  if (jsonRecipe) {
    return sanitizeMergedResult(
      {
        ...jsonRecipe,
        sourceUrl: jsonRecipe.sourceUrl ?? recipeSourceUrl,
      },
      jsonRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl
    );
  }

  if (
    /youtube\.com|youtu\.be/i.test(content) ||
    /youtube\.com|youtu\.be/i.test(recipeSourceUrl ?? "")
  ) {
    return parseYouTubeImport(content, recipeSourceUrl ?? parserBaseUrl);
  }

  // Force plain-text strategy: domain parsers are optimized for raw HTML pages.
  const parsed = parseWithFallbacks(content, parserBaseUrl);
  if (parsed)
    return sanitizeMergedResult(
      { ...parsed, sourceUrl: recipeSourceUrl },
      recipeSourceUrl ?? parserBaseUrl
    );

  return {
    sourceUrl: recipeSourceUrl,
    warnings: [
      "Import partiel depuis texte non structuré. Vérifie les champs avant de sauvegarder.",
    ],
  };
}
