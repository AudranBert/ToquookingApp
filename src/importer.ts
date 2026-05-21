import type { ParsedRecipe } from "./types";
import { findKnownRecipeOrigin } from "./origins";
import { parseIngredientLine } from "./utils/ingredients";

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

function parseDurationToMinutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (iso) return Number(iso[1] || 0) * 24 * 60 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0);
  return parseDurationText(value);
}

function parseDurationText(value: string) {
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

function arrayify(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(arrayify).filter(Boolean);
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(/\n|;/)
      .map(cleanText)
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return arrayify(node.url ?? node.contentUrl ?? node.embedUrl ?? node.text ?? node.name);
  }
  return [];
}

function metadataValues(recipe: Record<string, unknown>) {
  return [...arrayify(recipe.keywords), ...arrayify(recipe.recipeCategory), ...arrayify(recipe.recipeCuisine)]
    .map((value) => value.trim())
    .filter(Boolean);
}

function absolutizeUrl(value: string | undefined, baseUrl: string) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) {
    try {
      const { protocol } = new URL(baseUrl);
      return `${protocol}${trimmed}`;
    } catch {
      return `https:${trimmed}`;
    }
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function extractRecipeFromJsonLd(json: unknown, sourceUrl: string): ParsedRecipe | null {
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

function instructionText(item: unknown): string[] {
  if (typeof item === "string") return arrayify(item);
  if (!item || typeof item !== "object") return [];

  const node = item as Record<string, unknown>;
  const nested = node.itemListElement ?? node.steps ?? node.recipeInstructions;
  if (nested) {
    return arrayify(node.text ?? node.name).concat(
      Array.isArray(nested) ? nested.flatMap(instructionText) : instructionText(nested),
    );
  }

  return arrayify(node.text ?? node.name);
}

function servings(value: unknown) {
  const first = arrayify(value)[0];
  if (!first) return undefined;
  return Number.parseInt(first, 10) || undefined;
}

function recipeVideoUrl(recipe: Record<string, unknown>) {
  const firstVideo = Array.isArray(recipe.video) ? recipe.video[0] : recipe.video;
  return arrayify(firstVideo)[0];
}

function marmitonRestTime(html: string) {
  const text = cleanText(html);
  const match = text.match(/Repos\s*:\s*(.+?)\s+(?:Cuisson\s*:|Étape\s+1|Etape\s+1)/i);
  return match ? parseDurationText(match[1]) : undefined;
}

function defaultMarkdownFallback(content: string, sourceUrl: string): ParsedRecipe | null {
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

  const ingredientHeader = /(ingredients?|ingr\S*dients?)(?:\s+.+)?\s*:?\s*$/i;
  const instructionHeader = /(instructions?|steps?|directions?|pr\S*paration|method)(?:\s+.+)?\s*:?\s*$/i;
  const nextSectionHeader = /^\s{0,3}#{1,6}\s+\S+/;
  const bulletLine = /^\s*(?:[-*+]|(?:\d+[.)]))\s+(.+)$/;
  const stopSection = /(partagez vos photos|une question|commentaire|suivre les commentaires|recette partagee|essayez aussi|plan du site|flux rss|google-analytics)/i;
  const noiseLine = /(^(URL Source|Published Time|Markdown Content|Image)\s*:|<input|<textarea|<\/?\w+|formulaire_action|jQuery|autosave|_gaq|^\|$|^-->|^\/><input|required=|class=|accept=)/i;

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
  const imageUrl = absolutizeUrl(markdownImage ?? imageLabelLine ?? ogImage ?? firstHtmlImage, sourceUrl);

  if (ingredientLines.length === 0 && instructionLines.length === 0) return null;

  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions: instructionLines,
    warnings: ["Import from unstructured markdown/text. Verify ingredients and steps before saving."],
  };
}

function marmitonFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/marmiton/i.test(sourceUrl) && !/card-ingredient|recipe-preparation|ingr\S*dients|[eé]tape/i.test(content)) return null;

  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  let qty = "";
  let unit = "";
  let name = "";
  let complement = "";

  const flushIngredient = () => {
    const assembled = [qty, unit, name, complement].map((v) => cleanText(v)).filter(Boolean).join(" ");
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

    const parsedComplement = line.match(/data-ingredientComplement(?:Singular|Plural)="([^"]*)/i)?.[1];
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
    if (/^(J'ajoute mon grain de sel|Anonyme|Note de l'auteur|La recette en bref|Vous aimerez aussi)/i.test(stepLine)) break;
    if (/<|>|data-|^\W*$|^!?\[.*image/i.test(stepLine)) continue;
    instructions.push(stepLine);
  }

  // Markdown fallback path for Marmiton (r.jina.ai output), when data-* attributes are missing.
  if (ingredients.length === 0) {
    const rawLines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);
    const ingStart = rawLines.findIndex((line) => /ingr\S*dients/i.test(line));
    const prepStart = rawLines.findIndex((line) => /pr\S*paration/i.test(line));
    if (ingStart >= 0) {
      const stop = prepStart > ingStart ? prepStart : rawLines.length;
      for (let i = ingStart + 1; i < stop; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (/^(ustensiles|voir plus|voir moins|la suite apr|en cliquant|pr\S*paration)/i.test(line)) break;
        if (/^!?\[.*image/i.test(line) || /^https?:\/\//i.test(line)) continue;
        if (/^personnes$/i.test(line)) continue;
        if (/<|>|^\*+$/.test(line)) continue;
        if (/^(\d+(\s+\w+)?\s+)?[a-zA-ZÀ-ÿ]/.test(line)) ingredients.push(parseIngredientLine(line));
      }
    }
  }

  if (instructions.length === 0) {
    const rawLines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);
    for (let i = 0; i < rawLines.length; i += 1) {
      if (!/^[eé]tape\s*\d+/i.test(rawLines[i])) continue;
      let j = i + 1;
      while (j < rawLines.length && /^!?\[.*image/i.test(rawLines[j])) j += 1;
      const step = cleanText(rawLines[j] ?? "");
      if (!step) continue;
      if (/^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(step)) break;
      if (/<|>|^\*+$/.test(step)) continue;
      instructions.push(step);
    }
  }

  // Plain-text section fallback (matches what Marmiton exposes in crawl/text views).
  if (ingredients.length === 0 || instructions.length === 0) {
    const rawLines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);
    const ingStart = rawLines.findIndex((line) => /^ingr\S*dients?$/i.test(line));
    const prepStart = rawLines.findIndex((line) => /^pr\S*paration$/i.test(line));
    const toolsStart = rawLines.findIndex((line) => /^ustensiles$/i.test(line));

    if (ingStart >= 0) {
      const stop = [toolsStart, prepStart].filter((x) => x > ingStart).sort((a, b) => a - b)[0] ?? rawLines.length;
      for (let i = ingStart + 1; i < stop; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (/^version veggie|voir plus|voir moins|en cliquant|image[:\s]|^\[.*\]$|^\d+\/\d+$/i.test(line)) continue;
        if (/^https?:\/\//i.test(line)) continue;
        if (/^poivre$|^sel$/i.test(line) || /^\d+\s+/.test(line) || /os à moelle|bouquet garni|gousse|branches|navets|boeuf/i.test(line)) {
          ingredients.push(parseIngredientLine(line));
        }
      }
    }

    if (prepStart >= 0) {
      for (let i = prepStart + 1; i < rawLines.length; i += 1) {
        const line = rawLines[i];
        if (!line) continue;
        if (/^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(line)) break;
        if (/^temps total|^pr\S*paration\s*:|^repos\s*:|^cuisson\s*:|^[eé]tape\s*\d+/i.test(line)) continue;
        if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
        if (/<|>|^\*+$/.test(line)) continue;
        instructions.push(line);
      }
    }
  }

  const cleanedIngredients = ingredients.filter((ingredient) => {
    const line = cleanText(`${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name ?? ""}`);
    if (!line) return false;
    if (/^(personnes|ustensiles|voir plus|voir moins|la suite apr|en cliquant)/i.test(line)) return false;
    if (/^!?\[.*image/i.test(line) || /^https?:\/\//i.test(line)) return false;
    return true;
  });

  const dedupedIngredients: ReturnType<typeof parseIngredientLine>[] = [];
  const seen = new Set<string>();
  for (const ingredient of cleanedIngredients) {
    const key = cleanText(`${ingredient.quantity ?? ""}|${ingredient.unit ?? ""}|${ingredient.name ?? ""}`).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedupedIngredients.push(ingredient);
  }

  const cleanedInstructions = instructions.filter(
    (line) =>
      line &&
      !/^!?\[.*image/i.test(line) &&
      !/^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(line),
  );

  if (dedupedIngredients.length === 0 && cleanedInstructions.length === 0) return null;

  return {
    sourceUrl,
    ingredients: dedupedIngredients.length ? dedupedIngredients : undefined,
    instructions: cleanedInstructions.length ? cleanedInstructions : undefined,
    warnings: ["Import from unstructured markdown/text. Verify ingredients and steps before saving."],
  };
}

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

function cuisineLibreFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisine-libre\.org/i.test(sourceUrl)) return null;

  const normalized = content.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
  const lines = rawLines.map((line) => cleanText(line)).filter(Boolean);

  const title = cleanText(
    normalized.match(/^\s*Title:\s*(.+)$/im)?.[1] ??
      lines.find((line) => !/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(line)) ??
      "",
  );

  const ingredientStart = rawLines.findIndex((line) => /ingr\S*dients?\s+pour/i.test(cleanText(line)) || /^#+\s*ingr\S*dients?\b/i.test(line));
  const prepStart = rawLines.findIndex((line) => /^#+\s*pr\S*paration\b/i.test(line) || /^pr\S*paration\b/i.test(cleanText(line)));
  const endMarkers = /(recette partagee|partagez vos photos|une question|commentaire|suivre les commentaires|plan du site|essayer aussi|flux rss)/i;

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
      if (instructions.length === 0) continue;
      instructions[instructions.length - 1] = `${instructions[instructions.length - 1]} ${cleaned}`.trim();
    }
  }

  const markdownImages = [...normalized.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/gi)].map((m) => m[1]);
  const cacheImage =
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-vignettes\/[^\s"'()]+/i)?.[0] ??
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-gd2\/[^\s"'()]+/i)?.[0];
  const preferredMarkdownImage = markdownImages.find((url) => /\/local\/cache-vignettes\//i.test(url));
  const genericMetaImage = normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const imageCandidate = preferredMarkdownImage ?? cacheImage ?? markdownImages[0] ?? genericMetaImage;
  const imageUrl = absolutizeUrl(imageCandidate, sourceUrl);

  if (ingredientLines.length === 0 && instructions.length === 0) return null;

  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions,
    warnings: ["Import from unstructured markdown/text. Verify ingredients and steps before saving."],
  };
}

type DomainParser = (content: string, sourceUrl: string) => ParsedRecipe | null;

const DOMAIN_PARSERS: Array<{ hostPattern: RegExp; parser: DomainParser }> = [
  { hostPattern: /(^|\.)marmiton\.org$/i, parser: marmitonFallback },
  { hostPattern: /(^|\.)cuisine-libre\.org$/i, parser: cuisineLibreFallback },
];

function selectDomainParser(sourceUrl: string): DomainParser | null {
  try {
    const host = new URL(sourceUrl).hostname;
    return DOMAIN_PARSERS.find(({ hostPattern }) => hostPattern.test(host))?.parser ?? null;
  } catch {
    return null;
  }
}

function parseWithFallbacks(content: string, sourceUrl: string): ParsedRecipe | null {
  const domainParser = selectDomainParser(sourceUrl);
  const domainResult = domainParser?.(content, sourceUrl) ?? null;
  const defaultResult = defaultMarkdownFallback(content, sourceUrl);
  if (!domainResult) return defaultResult;
  // For known domains, prefer specialized parser output to avoid global parser pollution.
  if (/marmiton\.org|cuisine-libre\.org/i.test(sourceUrl)) return domainResult;
  if (!defaultResult) return domainResult;
  return mergeRecipes(domainResult, defaultResult);
}

function hasUsefulRecipeData(recipe: ParsedRecipe | null | undefined) {
  if (!recipe) return false;
  return (recipe.ingredients?.length ?? 0) > 0 || (recipe.instructions?.length ?? 0) > 0;
}

function qualityScore(lines: string[] | undefined) {
  if (!lines?.length) return 0;
  let score = 0;
  for (const line of lines) {
    if (!line) continue;
    if (/data-|<|>|https?:\/\/|jQuery|formulaire_action|autosave|_gaq/i.test(line)) {
      score -= 3;
      continue;
    }
    if (line.length < 2) {
      score -= 1;
      continue;
    }
    score += 2;
  }
  return score;
}

function mergeRecipes(base: ParsedRecipe | null, incoming: ParsedRecipe): ParsedRecipe {
  if (!base) return incoming;
  const baseIngredients = base.ingredients ?? [];
  const incomingIngredients = incoming.ingredients ?? [];
  const baseInstructions = base.instructions ?? [];
  const incomingInstructions = incoming.instructions ?? [];

  const pickIngredients =
    qualityScore(incomingIngredients.map((x) => x.name ?? "")) > qualityScore(baseIngredients.map((x) => x.name ?? ""))
      ? incoming.ingredients
      : base.ingredients;
  const pickInstructions =
    qualityScore(incomingInstructions) > qualityScore(baseInstructions) ? incoming.instructions : base.instructions;

  return {
    ...base,
    ...incoming,
    name: base.name?.trim() ? base.name : incoming.name,
    origin: base.origin ?? incoming.origin,
    sourceUrl: base.sourceUrl ?? incoming.sourceUrl,
    videoUrl: base.videoUrl ?? incoming.videoUrl,
    imageUrl: base.imageUrl ?? incoming.imageUrl,
    servings: base.servings ?? incoming.servings,
    prepTime: base.prepTime ?? incoming.prepTime,
    restTime: base.restTime ?? incoming.restTime,
    cookTime: base.cookTime ?? incoming.cookTime,
    totalTime: base.totalTime ?? incoming.totalTime,
    ingredients: pickIngredients,
    instructions: pickInstructions,
    tags: Array.from(new Set([...(base.tags ?? []), ...(incoming.tags ?? [])])),
    warnings: Array.from(new Set([...(base.warnings ?? []), ...(incoming.warnings ?? [])])),
  };
}

function isLocalDevHost() {
  return /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
}

export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    if (isLocalDevHost()) {
      const endpoint = `${import.meta.env.BASE_URL}api/import?url=${encodeURIComponent(url)}`;
      const response = await fetch(endpoint, { signal: controller.signal });
      if (response.ok) return response.json();
    }
  } catch {
    // Static builds do not have the local API endpoint.
  } finally {
    window.clearTimeout(timer);
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    return {
      sourceUrl: url,
      videoUrl: url,
      name: "Recette YouTube",
      warnings: ["Import YouTube partiel : verifie le titre, les ingredients et les etapes manuellement."],
    };
  }

  try {
    const htmlSources = await fetchRecipeHtmls(url);
    let merged: ParsedRecipe | null = null;

    for (const html of htmlSources) {
      const jsonLdScripts = [
        ...html.matchAll(
          /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi,
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
                : ["Aucun nom detecte dans la recette importee. Renseigne-le manuellement."],
            };
            merged = mergeRecipes(merged, enriched);
          } catch {
            continue;
          }
        }
      }

      const markdownFallback = parseWithFallbacks(html, url);
      if (markdownFallback) {
        merged = mergeRecipes(merged, markdownFallback);
      }
    }

    if (merged) {
      if (!merged.name || /^noname$/i.test(merged.name.trim())) {
        merged.name = fallbackNameFromUrl(url) ?? merged.name;
      }
      return merged;
    }
  } catch {
    return {
      sourceUrl: url,
      warnings: ["Import automatique indisponible pour ce site. Le lien est conserve, complete la recette manuellement."],
    };
  }

  return {
    sourceUrl: url,
    warnings: ["Aucune recette structuree trouvee. Le lien est conserve, complete les champs manquants."],
  };
}

async function fetchRecipeHtmls(url: string): Promise<string[]> {
  const sources: string[] = [];

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/markdown,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    if (response.ok) sources.push(await response.text());
  } catch {
    // Continue with fallback proxies below.
  }

  const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(allOriginsUrl);
    if (response.ok) sources.push(await response.text());
  } catch {
    // Continue with last fallback.
  }

  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
  try {
    const response = await fetch(jinaUrl);
    if (response.ok) sources.push(await response.text());
  } catch {
    // Keep existing behavior: caller handles no-source case.
  }

  if (sources.length === 0) throw new Error("Unable to fetch source HTML");
  return sources;
}
