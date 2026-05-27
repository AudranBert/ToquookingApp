import type { ParsedRecipe } from "./types";
import { findKnownRecipeOrigin } from "./origins";
import { parseIngredientLine } from "./utils/ingredients";

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
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
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "-",
  frac12: "1/2",
};

function repairMojibake(value: string) {
  if (!/[ÃÂâï¿\u0019]/.test(value)) return value;
  const cp1252Map: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  const toCp1252Byte = (char: string) => {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) return code;
    return cp1252Map[code] ?? 0x3f;
  };

  try {
    const bytes = Uint8Array.from(Array.from(value, toCp1252Byte));
    const repaired = new TextDecoder("utf-8").decode(bytes);
    const originalNoise = (value.match(/[ÃÂâï¿\u0019]/g) ?? []).length;
    const repairedNoise = (repaired.match(/[ÃÂâï¿\u0019]/g) ?? []).length;
    return repairedNoise < originalNoise ? repaired : value;
  } catch {
    return value;
  }
}

function isLikelyRecipeImage(url?: string) {
  if (!url) return false;
  if (/\/IMG\/groupeon\d+\.png/i.test(url)) return false;
  if (/\/moton\d+/i.test(url)) return false;
  if (/logo|sprite|icon|avatar|placeholder|default-image|social|banner|favicon/i.test(url)) return false;
  if (/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) return false;
  if (/_h(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) return false;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w100\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) return false;
  return /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url) || /local\/cache-(?:gd2|vignettes)\//i.test(url);
}

function imageCandidateScore(url: string) {
  let score = 0;
  if (/recette|recipe|food|plat|dish|cooking|\/photos?\//i.test(url)) score += 5;
  if (/\/uploads\/|\/wp-content\/|\/media\/|\/images?\//i.test(url)) score += 2;
  if (/logo|sprite|icon|avatar|placeholder|default-image|social|banner|favicon/i.test(url)) score -= 8;
  if (/\/IMG\/groupeon\d+\.png|\/moton\d+/i.test(url)) score -= 8;
  if (/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 10;
  if (/_h(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 10;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w100\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 12;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w200\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 14;
  if (/_w(?:[6-9]\d\d|[1-9]\d{3,})\./i.test(url)) score += 3;
  if (/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score += 1;
  return score;
}

function pickBestImageCandidate(candidates: Array<string | undefined>, sourceUrl: string) {
  const absolutes = candidates
    .filter(Boolean)
    .map((value) => absolutizeUrl(value, sourceUrl))
    .filter((value): value is string => Boolean(value));
  if (absolutes.length === 0) return undefined;
  const best = [...absolutes].sort((a, b) => imageCandidateScore(b) - imageCandidateScore(a))[0];
  if (isLikelyRecipeImage(best)) return best;
  const likely = absolutes.find((url) => isLikelyRecipeImage(url));
  return likely ?? best;
}

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
  return stripWrappingQuotes(
    repairMojibake(decodeHtmlEntities(String(value)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
  );
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
    ["«", "»"],
    ["â€œ", "â€\u009d"],
    ["â€˜", "â€™"],
    ["Â«", "Â»"],
  ];
  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end) && trimmed.length >= start.length + end.length) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim();
    }
  }
  return trimmed;
}

function isImageMarkdownLine(value: string) {
  return /^!?\[.*image/i.test(value);
}

function isInstructionNoise(value: string) {
  return (
    !value ||
    /^https?:\/\//i.test(value) ||
    isImageMarkdownLine(value) ||
    /^\*+\s*\*+$/.test(value.trim()) ||
    /value=|formulaire_action|jQuery|autosave|_gaq|trackingParams|commandMetadata|navigationEndpoint/i.test(value)
  );
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

function extractRecipeFromMrtnRecipesData(html: string, sourceUrl: string): ParsedRecipe | null {
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

    const servingsValue = recipe.nb_pers == null ? undefined : Number.parseInt(String(recipe.nb_pers), 10) || undefined;
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

function extractRecipeFromMicrodataHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const normalized = html.replace(/\r\n/g, "\n");
  const block =
    normalized.match(/<article[^>]+itemtype=["'][^"']*schema\.org\/Recipe[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    normalized;

  const name =
    cleanText(block.match(/itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    cleanText(block.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]);

  const ingredientMatches = [
    ...block.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/li>/gi),
  ];
  const ingredients = ingredientMatches
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .map(parseIngredientLine);

  const instructionContainer =
    block.match(/itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i)?.[1] ?? "";
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
        "",
    ),
    10,
  );

  const prepTime = parseDurationToMinutes(
    block.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  const cookTime = parseDurationToMinutes(
    block.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  const totalTime = parseDurationToMinutes(
    block.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
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

function extractMarmitonCarouselImageCandidates(html: string) {
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

    const srcset = block.match(/\bsrcset=["']([^"']+)["']/i)?.[1] ?? block.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1];
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
  const diapoPhotosMatch = html.match(/af_diapo_list\.push\(\{[\s\S]*?photos\s*:\s*\[([\s\S]*?)\]\s*,\s*sButtons/i);
  if (diapoPhotosMatch?.[1]) {
    for (const match of diapoPhotosMatch[1].matchAll(/https?:\/\/assets\.afcdn\.com\/recipe\/[^"'\\\s,)\]]+_w(?:600|648|1024)[^"'\\\s,)\]]*/gi)) {
      push(match[0]);
    }
  }

  const deduped = Array.from(new Set(urls));
  return deduped.filter((url) => !/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url));
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
    warnings: ["Import partiel depuis contenu non structure. Verifie ingredients, etapes et quantites avant de sauvegarder."],
  };
}

function marmitonFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/marmiton/i.test(sourceUrl) && !/card-ingredient|recipe-preparation|ingr\S*dients|[eé]tape/i.test(content)) return null;

  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);
  const title =
    cleanText(normalized.match(/^\s*Title:\s*(.+)$/im)?.[1]) ||
    cleanText(normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
    cleanText(normalized.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]);

  const servingsValue =
    servings(
      cleanText(
        normalized.match(/(\d+)\s*personnes?/i)?.[0] ??
          normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
          "",
      ),
    ) ?? undefined;

  const prepTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Pr\S*paration\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const cookTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Cuisson\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const totalTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Temps\s+total\s*:\s*([^\n<]+)/i)?.[1] ?? ""));
  const restTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']restTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    marmitonRestTime(normalized);
  const carouselImages = extractMarmitonCarouselImageCandidates(normalized);

  const imageUrl = pickBestImageCandidate(
    [
      ...carouselImages,
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
      normalized.match(/^\s*Image\s*:\s*(https?:\/\/\S+)\s*$/im)?.[1],
      normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/i)?.[1],
      normalized.match(/<img[^>]+src=["']([^"']+recette[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i)?.[1],
      normalized.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:recipe|recette|food|dish)/i)?.[1],
    ],
    sourceUrl,
  );

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
    if (/<|>|data-|^\W*$/.test(stepLine) || isInstructionNoise(stepLine)) continue;
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
      while (j < rawLines.length && isImageMarkdownLine(rawLines[j])) j += 1;
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
  const seenByName = new Set<string>();
  const canonicalName = (value: string) =>
    cleanText(value)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\(.*?\)/g, "")
      .replace(/x$/i, "")
      .replace(/s$/i, "");
  for (const ingredient of cleanedIngredients) {
    const key = cleanText(`${ingredient.quantity ?? ""}|${ingredient.unit ?? ""}|${ingredient.name ?? ""}`).toLowerCase();
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
      !/^(A Anonyme|Note de l'auteur|La recette en bref|Qu'est-ce qu'on mange|Vous aimerez aussi)/i.test(line),
  );

  if (dedupedIngredients.length === 0 && cleanedInstructions.length === 0) return null;
  const hasCoreFields = Boolean(title && servingsValue && (prepTime || cookTime || totalTime) && imageUrl);
  const hasStructuredEnough = Boolean(title && imageUrl && (dedupedIngredients.length > 0 || cleanedInstructions.length > 0));

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
    warnings: hasCoreFields || hasStructuredEnough
      ? undefined
      : ["Import partiel depuis contenu non structure. Verifie ingredients, etapes et quantites avant de sauvegarder."],
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

  // Dedicated structured path for cuisine-libre pages (preferred over text heuristics).
  const structured = extractRecipeFromMicrodataHtml(content, sourceUrl);
  if (structured && (structured.ingredients?.length ?? 0) > 0 && (structured.instructions?.length ?? 0) > 0) {
    const normalized = content.replace(/\r\n/g, "\n");
    const prepTime =
      structured.prepTime ??
      parseDurationToMinutes(normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]);
    const cookTime =
      structured.cookTime ??
      parseDurationToMinutes(normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]);
    const totalTime =
      structured.totalTime ??
      parseDurationToMinutes(normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]);
    const servingsValue =
      structured.servings ??
      servings(
        cleanText(
          normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
            normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
            "",
        ),
      );
    const imageUrl = pickBestImageCandidate(
      [
        structured.imageUrl,
        normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
        normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
        normalized.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1],
      ],
      sourceUrl,
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
      if (instructions.length === 0 && cleaned.length > 20) {
        instructions.push(cleaned);
        continue;
      }
      if (instructions.length === 0) continue;
      instructions[instructions.length - 1] = `${instructions[instructions.length - 1]} ${cleaned}`.trim();
    }
  }

  if (prepStart >= 0 && instructions.length === 0) {
    for (let i = prepStart + 1; i < rawLines.length; i += 1) {
      const cleaned = cleanText(rawLines[i]);
      if (!cleaned) continue;
      if (endMarkers.test(cleaned)) break;
      if (/<|>|jQuery|formulaire_action|autosave|_gaq|^\*+$|^\|$/.test(cleaned)) continue;
      if (/^(temps total|pr\S*paration\s*:|repos\s*:|cuisson\s*:|mijot|sans )/i.test(cleaned)) continue;
      if (/^ingr\S*dients?/i.test(cleaned)) continue;
      if (cleaned.length < 12) continue;
      instructions.push(cleaned.replace(/^\d+[.)]\s*/, ""));
    }
  }

  const servingsText =
    cleanText(normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]) ||
    cleanText(normalized.match(/Ingr\S*dients?\s+[^<\n]*pour\s+([^<\n]+)/i)?.[1]);
  const servingsValue = servings(servingsText);

  const prepTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Pr\S*paration\s*:\s*([^<\n]+)/i)?.[1] ?? ""));
  const cookTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Cuisson\s*:\s*([^<\n]+)/i)?.[1] ?? ""));
  const totalTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    parseDurationText(cleanText(normalized.match(/Dur\S*e\s+totale\s*:\s*([^<\n]+)/i)?.[1] ?? ""));

  const markdownImages = [...normalized.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/gi)].map((m) => m[1]);
  const cacheImage =
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-vignettes\/[^\s"'()]+/i)?.[0] ??
    normalized.match(/https?:\/\/[^\s"'()]*\/local\/cache-gd2\/[^\s"'()]+/i)?.[0];
  const preferredMarkdownImage = markdownImages.find((url) => /\/local\/cache-vignettes\//i.test(url));
  const genericMetaImage = normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const twitterImage = normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const imageSrc = normalized.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1];
  const imageCandidate = preferredMarkdownImage ?? cacheImage ?? genericMetaImage ?? twitterImage ?? imageSrc ?? markdownImages[0];
  const imageUrl = absolutizeUrl(imageCandidate, sourceUrl);

  if (ingredientLines.length === 0 && instructions.length === 0) return null;

  // Guardrails against noisy crawler/plain-text variants.
  const noisyInstructionHit = instructions.some((line) =>
    /(value=|formulaire_action|jQuery|autosave|_gaq|Rated \d+\.\d+ out of 5|Adresse [ée]lectronique|Votre pseudo)/i.test(line),
  );
  if (ingredientLines.length > 25 || instructions.length > 20 || noisyInstructionHit) {
    return null;
  }

  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    servings: servingsValue,
    prepTime,
    cookTime,
    totalTime,
    ingredients: ingredientLines.map(parseIngredientLine),
    instructions,
    warnings: ["Import partiel depuis contenu non structure. Verifie ingredients, etapes et quantites avant de sauvegarder."],
  };
}

type DomainParser = (content: string, sourceUrl: string) => ParsedRecipe | null;

function markdownSectionExtractor(
  content: string,
  sourceUrl: string,
  sectionLabels: { ingredients: RegExp; instructions: RegExp; stop?: RegExp },
): ParsedRecipe | null {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);

  const title = cleanText(
    normalized.match(/^\s*Title:\s*(.+)$/im)?.[1] ??
      lines.find((line) => !/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(line)) ??
      "",
  );

  const ingStart = lines.findIndex((line) => sectionLabels.ingredients.test(line));
  const prepStart = lines.findIndex((line) => sectionLabels.instructions.test(line));
  const stop = sectionLabels.stop ?? /(vous aimerez aussi|commentaires?|newsletter|partage|a lire aussi|publicit[eé]|ustensiles)/i;

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  if (ingStart >= 0) {
    const end = prepStart > ingStart ? prepStart : lines.length;
    for (let i = ingStart + 1; i < end; i += 1) {
      const line = lines[i];
      if (!line || stop.test(line)) break;
      if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
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
      if (/^!?\[.*image|^https?:\/\//i.test(line)) continue;
      if (/^(temps total|pr[eé]paration\s*:|repos\s*:|cuisson\s*:)/i.test(line)) continue;
      if (/^[eé]tape\s*\d+/i.test(line)) continue;
      if (/^\*+$|^\|$/.test(line)) continue;
      instructions.push(line.replace(/^\d+[.)]\s*/, ""));
    }
  }

  const imageFromMd = normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/i)?.[1];
  const ogImage = normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const imageUrl = absolutizeUrl(imageFromMd ?? ogImage, sourceUrl);

  if (ingredients.length === 0 && instructions.length === 0) return null;
  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    warnings: ["Import partiel depuis contenu non structure. Verifie ingredients, etapes et quantites avant de sauvegarder."],
  };
}

function cuisineAzFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisineaz\.com/i.test(sourceUrl)) return null;
  return markdownSectionExtractor(content, sourceUrl, {
    ingredients: /ingr\S*dients?/i,
    instructions: /(pr\S*paration|etapes?|instructions?)/i,
    stop: /(astuces|conseils|questions|commentaires?|a lire aussi|newsletter)/i,
  });
}

function papillesEtPupillesFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/papillesetpupilles\.fr/i.test(sourceUrl)) return null;
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => cleanText(line)).filter(Boolean);
  const title = cleanText(
    normalized.match(/^\s*Title:\s*(.+)$/im)?.[1] ??
      lines.find((line) => !/^(URL Source|Published Time|Markdown Content|Image)\s*:/i.test(line)) ??
      "",
  );
  const ingStart = lines.findIndex((line) => /^ingr\S*dients?$/i.test(line));
  const prepStart = lines.findIndex((line) => /^pr\S*paration$/i.test(line));
  const stop = /(questions|pourquoi j'aime|r[ée]dig[ée] par|tags\s*:|newsletter|commentaires?)/i;

  const ingredients: ReturnType<typeof parseIngredientLine>[] = [];
  if (ingStart >= 0) {
    const end = prepStart > ingStart ? prepStart : lines.length;
    for (let i = ingStart + 1; i < end; i += 1) {
      const line = lines[i];
      if (!line || stop.test(line)) break;
      if (/^pour\s+\d+/i.test(line)) continue;
      if (!/^[*•-]\s+/.test(line)) continue;
      const item = cleanText(line.replace(/^[*•-]\s+/, ""));
      if (!item || /recettes par ingr|produits de saison|a la decouverte|mieux connaitre/i.test(item)) continue;
      ingredients.push(parseIngredientLine(item));
    }
  }

  const instructions: string[] = [];
  if (prepStart >= 0) {
    for (let i = prepStart + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (stop.test(line)) break;
      if (/^image\s*:|^pour\s+\d+/i.test(line)) continue;
      if (line.length < 12) continue;
      instructions.push(line);
    }
  }

  const imageUrl = absolutizeUrl(
    normalized.match(/https?:\/\/[^\s"'()]*\/wp-content\/uploads\/[^\s"'()]+/i)?.[0] ??
      normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    sourceUrl,
  );

  if (ingredients.length === 0 && instructions.length === 0) return null;
  return {
    sourceUrl,
    name: title || undefined,
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    warnings: ["Import partiel depuis contenu non structure. Verifie ingredients, etapes et quantites avant de sauvegarder."],
  };
}

function cuisineActuelleFallback(content: string, sourceUrl: string): ParsedRecipe | null {
  if (!/cuisineactuelle\.fr/i.test(sourceUrl)) return null;
  return markdownSectionExtractor(content, sourceUrl, {
    ingredients: /ingr\S*dients?/i,
    instructions: /(pr\S*paration|etapes?|instructions?)/i,
    stop: /(vous aimerez aussi|commentaires?|newsletter|publicit[eé])/i,
  });
}

const DOMAIN_PARSERS: Array<{ hostPattern: RegExp; parser: DomainParser }> = [
  { hostPattern: /(^|\.)marmiton\.org$/i, parser: marmitonFallback },
  { hostPattern: /(^|\.)cuisine-libre\.org$/i, parser: cuisineLibreFallback },
  { hostPattern: /(^|\.)cuisineaz\.com$/i, parser: cuisineAzFallback },
  { hostPattern: /(^|\.)papillesetpupilles\.fr$/i, parser: papillesEtPupillesFallback },
  { hostPattern: /(^|\.)cuisineactuelle\.fr$/i, parser: cuisineActuelleFallback },
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
  // For known domains, only trust specialized parser to avoid global parser pollution.
  if (domainParser) {
    if ((/cuisine-libre\.org|papillesetpupilles\.fr/i.test(sourceUrl)) && !domainResult) return defaultResult;
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
  const defaultResult = defaultMarkdownFallback(content, sourceUrl);
  let jsonLdImage: string | undefined;
  const jsonLdScripts = [
    ...normalized.matchAll(
      /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  for (const match of jsonLdScripts) {
    for (const body of [match[1], decodeHtmlEntities(match[1])]) {
      try {
        const parsed = extractRecipeFromJsonLd(JSON.parse(body), sourceUrl);
        if (parsed?.imageUrl) {
          jsonLdImage = parsed.imageUrl;
          break;
        }
      } catch {
        // ignore invalid JSON-LD snippets
      }
    }
    if (jsonLdImage) break;
  }

  const name =
    cleanText(normalized.match(/^\s*Title:\s*(.+)$/im)?.[1]) ||
    cleanText(normalized.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]) ||
    cleanText(normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const imageUrl = absolutizeUrl(
    normalized.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      normalized.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      jsonLdImage,
    sourceUrl,
  );
  const prepTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']prepTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  const cookTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']cookTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  const totalTime = parseDurationToMinutes(
    normalized.match(/itemprop=["']totalTime["'][^>]+content=["']([^"']+)["']/i)?.[1],
  );
  const restTime =
    parseDurationToMinutes(normalized.match(/itemprop=["']restTime["'][^>]+content=["']([^"']+)["']/i)?.[1]) ??
    (/marmiton/i.test(sourceUrl) ? marmitonRestTime(normalized) : undefined);
  const servingsValue = servings(
    cleanText(
      normalized.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
        normalized.match(/itemprop=["']recipeYield["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        normalized.match(/(\d+)\s*personnes?/i)?.[0] ??
        "",
    ),
  );

  const enrichedDomain: ParsedRecipe = {
    ...(domainResult ?? {}),
    sourceUrl,
    name: domainResult?.name ?? name ?? undefined,
    imageUrl: domainResult?.imageUrl ?? imageUrl ?? undefined,
    servings: domainResult?.servings ?? servingsValue ?? undefined,
    prepTime: domainResult?.prepTime ?? prepTime ?? undefined,
    restTime: domainResult?.restTime ?? restTime ?? undefined,
    cookTime: domainResult?.cookTime ?? cookTime ?? undefined,
    totalTime: domainResult?.totalTime ?? totalTime ?? undefined,
  };

  if ((enrichedDomain.ingredients?.length ?? 0) === 0 && defaultResult) return mergeRecipes(enrichedDomain, defaultResult);
  if ((enrichedDomain.instructions?.length ?? 0) === 0 && defaultResult) return mergeRecipes(enrichedDomain, defaultResult);
  return enrichedDomain;
}

function hasKnownDomain(sourceUrl: string) {
  return Boolean(selectDomainParser(sourceUrl));
}

function parseMarmitonStructuredOnly(html: string, sourceUrl: string): ParsedRecipe | null {
  const normalized = html.replace(/\r\n/g, "\n");
  const candidates: ParsedRecipe[] = [];

  const jsonLdScripts = [
    ...normalized.matchAll(
      /<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi,
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
    sourceUrl,
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

function extractMarmitonStepsFromHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const instructions = [...html.matchAll(/<div class="recipe-step-list__container"[\s\S]*?<p>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .filter((line) => !/�/.test(line));

  const ingredientRows = [...html.matchAll(/data-ingredientQuantity="([^"]*)"[\s\S]*?data-unit(?:Singular|Plural)="([^"]*)"[\s\S]*?data-ingredientName(?:Singular|Plural)="([^"]*)"[\s\S]*?data-ingredientComplement(?:Singular|Plural)="([^"]*)"/gi)];
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
    sourceUrl,
  );

  if (instructions.length === 0 && ingredients.length === 0) return null;
  return {
    sourceUrl,
    imageUrl,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
  };
}

function pickCleanestLines(lines: string[] | undefined) {
  if (!lines?.length) return lines;
  const clean = lines.filter((line) => !/�/.test(line));
  return clean.length ? clean : lines;
}

function pickCleanestIngredients(ingredients: ReturnType<typeof parseIngredientLine>[] | undefined) {
  if (!ingredients?.length) return ingredients;
  const clean = ingredients.filter((ing) => !/�/.test(cleanText(`${ing.quantity ?? ""} ${ing.unit ?? ""} ${ing.name ?? ""}`)));
  return clean.length ? clean : ingredients;
}

function sourceTextQualityScore(value: string) {
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  const mojibake = (value.match(/[ÃÂâï¿]/g) ?? []).length;
  const recipeSignals = (value.match(/recipeIngredient|recipeInstructions|itemprop=["']recipe/i) ?? []).length;
  return recipeSignals * 20 - replacement * 8 - mojibake * 3;
}

function isAcceptableMarmitonSource(value: string) {
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  const signal = (value.match(/recipe-step-list__container|Mrtn\.recipesData|application\/ld\+json|recipeIngredient|recipeInstructions/gi) ?? []).length;
  if (signal === 0) return false;
  const maxReplacement = Math.max(8, Math.floor(value.length / 3000));
  return replacement <= maxReplacement;
}

function decodeResponseBody(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const cp1252 = new TextDecoder("windows-1252").decode(bytes);
  return sourceTextQualityScore(cp1252) > sourceTextQualityScore(utf8) ? cp1252 : utf8;
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
    (shortDescription || text).match(/ingredients?\s*:\s*([\s\S]*?)(?:\n\s*(?:cuisson|préparation|#|\b\d+\s*vues|\bPartager\b)|$)/i)?.[1] ??
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
          line,
        ),
    )
    .map((line) => parseIngredientLine(line));

  const cuissonLine = cleanText((shortDescription || text).match(/cuisson[^\r\n.]*/i)?.[0] ?? "");
  const maybeSteps = [cuissonLine].filter((line) => line.length > 8);

  return {
    sourceUrl,
    videoUrl: sourceUrl,
    name: title || "Recette YouTube",
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: maybeSteps.length ? maybeSteps : undefined,
    warnings: ["Import YouTube partiel : description detectee partiellement. Verifie titre, ingredients et etapes manuellement."],
  };
}

function sanitizeMergedResult(recipe: ParsedRecipe, sourceUrl: string): ParsedRecipe {
  const merged = { ...recipe };
  if (!merged.name || /^noname$/i.test(merged.name.trim())) {
    merged.name = fallbackNameFromUrl(sourceUrl) ?? merged.name;
  }
  if (merged.instructions?.length) {
    merged.instructions = merged.instructions.filter((line) => !isInstructionNoise(line));
  }
  if (/cuisine-libre\.org/i.test(sourceUrl) && merged.instructions?.length) {
    merged.instructions = merged.instructions.filter(
      (line) =>
        !/^(temps|cuisson\s*:|mijot|sans |rated |\d+\s+vues|partagez|imprimer|facebook|twitter|envoyer cette recette|veuillez laisser ce champ|jQuery|value=)/i.test(
          line,
        ),
    );
  }
  if (/cuisineactuelle\.fr/i.test(sourceUrl) && merged.ingredients?.length) {
    merged.ingredients = merged.ingredients.filter((ing) => !/^ingr\S*dients?$/i.test(cleanText(ing.name ?? "")));
  }
  if (hasKnownDomain(sourceUrl) && merged.instructions && merged.instructions.length > 120) {
    merged.instructions = merged.instructions.slice(0, 40);
  }
  if (hasKnownDomain(sourceUrl) && merged.ingredients && merged.ingredients.length > 60) {
    merged.ingredients = merged.ingredients.slice(0, 30);
  }
  return merged;
}

function finalizeRecipe(sourceUrl: string, structured: ParsedRecipe | null, fallback: ParsedRecipe | null): ParsedRecipe | null {
  const structuredUseful = hasUsefulRecipeData(structured);
  if (structuredUseful && structured) {
    const resolvedName =
      structured.name && !/^noname$/i.test(structured.name.trim()) ? structured.name : fallbackNameFromUrl(sourceUrl);
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

function qualityScore(lines: string[] | undefined) {
  if (!lines?.length) return 0;
  let score = 0;
  for (const line of lines) {
    if (!line) continue;
    if (line.includes("�")) {
      score -= 40;
      continue;
    }
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

function replacementCharCount(lines: string[] | undefined) {
  if (!lines?.length) return 0;
  return lines.reduce((count, line) => count + ((line.match(/�/g) ?? []).length), 0);
}

function mergeRecipes(base: ParsedRecipe | null, incoming: ParsedRecipe): ParsedRecipe {
  if (!base) return incoming;
  const baseIngredients = base.ingredients ?? [];
  const incomingIngredients = incoming.ingredients ?? [];
  const baseInstructions = base.instructions ?? [];
  const incomingInstructions = incoming.instructions ?? [];

  const baseIngredientLines = baseIngredients.map((x) => x.name ?? "");
  const incomingIngredientLines = incomingIngredients.map((x) => x.name ?? "");
  const baseIngredientReplacementCount = replacementCharCount(baseIngredientLines);
  const incomingIngredientReplacementCount = replacementCharCount(incomingIngredientLines);
  const pickIngredients =
    incomingIngredientReplacementCount < baseIngredientReplacementCount
      ? incoming.ingredients
      : incomingIngredientReplacementCount > baseIngredientReplacementCount
        ? base.ingredients
        : qualityScore(incomingIngredientLines) > qualityScore(baseIngredientLines)
          ? incoming.ingredients
          : base.ingredients;

  const baseInstructionReplacementCount = replacementCharCount(baseInstructions);
  const incomingInstructionReplacementCount = replacementCharCount(incomingInstructions);
  const pickInstructions =
    incomingInstructionReplacementCount < baseInstructionReplacementCount
      ? incoming.instructions
      : incomingInstructionReplacementCount > baseInstructionReplacementCount
        ? base.instructions
        : qualityScore(incomingInstructions) > qualityScore(baseInstructions)
          ? incoming.instructions
          : base.instructions;
  const pickImage =
    !isLikelyRecipeImage(base.imageUrl) && isLikelyRecipeImage(incoming.imageUrl)
      ? incoming.imageUrl
      : (base.imageUrl ?? incoming.imageUrl);

  return {
    ...base,
    ...incoming,
    name:
      base.name?.trim() && !/^noname$/i.test(base.name.trim())
        ? base.name
        : incoming.name,
    origin: base.origin ?? incoming.origin,
    sourceUrl: base.sourceUrl ?? incoming.sourceUrl,
    videoUrl: base.videoUrl ?? incoming.videoUrl,
    imageUrl: pickImage,
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

function shouldUseLocalImportApi() {
  return import.meta.env.VITE_USE_LOCAL_IMPORT_API === "true";
}

export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    // Opt-in only: local API may run a different parser than the frontend build.
    // Keep frontend importer as the default to match GitHub Pages behavior.
    if (isLocalDevHost() && shouldUseLocalImportApi()) {
      const endpoint = `${import.meta.env.BASE_URL}api/import?url=${encodeURIComponent(url)}`;
      const response = await fetch(endpoint, { signal: controller.signal });
      if (response.ok) return response.json();
    }
  } catch {
    // Static builds do not have the local API endpoint.
  } finally {
    window.clearTimeout(timer);
  }

  try {
    const htmlSourcesRaw = await fetchRecipeHtmls(url);
    const isMarmiton = /(^https?:\/\/)?([^/]+\.)?marmiton\.org\//i.test(url);
    const htmlSources = (isMarmiton ? htmlSourcesRaw.filter(isAcceptableMarmitonSource) : htmlSourcesRaw).sort(
      (a, b) => sourceTextQualityScore(b) - sourceTextQualityScore(a),
    );
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
                : ["Nom non detecte automatiquement. Renseigne le titre manuellement."],
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

    if (merged) {
      return sanitizeMergedResult(merged, url);
    }
  } catch {
    return {
      sourceUrl: url,
      warnings: ["Import automatique indisponible pour ce site pour le moment. Le lien est conserve, complete la recette manuellement."],
    };
  }

  return {
    sourceUrl: url,
    warnings: ["Aucune recette exploitable detectee sur cette page. Le lien est conserve, complete les champs manquants."],
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
  const normalizedSourceUrl = sourceUrl ? (/^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`) : undefined;
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
      sharedPayloadRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl,
    );
  }

  const structuredShareRecipe = parseRecipeFromToqueShareText(content);
  if (structuredShareRecipe) {
    return sanitizeMergedResult(
      {
        ...structuredShareRecipe,
        sourceUrl: structuredShareRecipe.sourceUrl ?? recipeSourceUrl,
      },
      structuredShareRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl,
    );
  }

  const jsonRecipe = parseRecipeFromJsonText(content);
  if (jsonRecipe) {
    return sanitizeMergedResult(
      {
        ...jsonRecipe,
        sourceUrl: jsonRecipe.sourceUrl ?? recipeSourceUrl,
      },
      jsonRecipe.sourceUrl ?? recipeSourceUrl ?? parserBaseUrl,
    );
  }

  if (/youtube\.com|youtu\.be/i.test(content) || /youtube\.com|youtu\.be/i.test(recipeSourceUrl ?? "")) {
    return parseYouTubeImport(content, recipeSourceUrl ?? parserBaseUrl);
  }

  // Force plain-text strategy: domain parsers are optimized for raw HTML pages.
  const parsed = parseWithFallbacks(content, parserBaseUrl);
  if (parsed) return sanitizeMergedResult({ ...parsed, sourceUrl: recipeSourceUrl }, recipeSourceUrl ?? parserBaseUrl);

  return {
    sourceUrl: recipeSourceUrl,
    warnings: ["Import partiel depuis texte non structure. Verifie les champs avant de sauvegarder."],
  };
}

function parseRecipeFromToqueShareText(content: string): ParsedRecipe | null {
  if (!/\bIngredients:\s*$/im.test(content) || !/\bInstructions:\s*$/im.test(content)) return null;
  const lines = content.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd());
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const name = cleanText(nonEmpty[0] ?? "");
  if (!name) return null;

  const metaLine = nonEmpty.find((line) => /personne\(s\)|Preparation|Cuisson|Total|Repos/i.test(line)) ?? "";
  const servings = Number.parseInt(metaLine.match(/(\d+)\s*personne\(s\)/i)?.[1] ?? "", 10) || undefined;
  const prepTime = Number.parseInt(metaLine.match(/Preparation\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;
  const restTime = Number.parseInt(metaLine.match(/Repos\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;
  const cookTime = Number.parseInt(metaLine.match(/Cuisson\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;
  const totalTime = Number.parseInt(metaLine.match(/Total\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;

  const tagsLine = nonEmpty.find((line) => /^Tags:\s*/i.test(line));
  const originLine = nonEmpty.find((line) => /^Origine:\s*/i.test(line));
  const sourceLine = nonEmpty.find((line) => /^Source:\s*/i.test(line));
  const videoLine = nonEmpty.find((line) => /^Video:\s*/i.test(line));
  const imageLine = nonEmpty.find((line) => /^Image:\s*/i.test(line));
  const notesStart = lines.findIndex((line) => /^Notes:\s*$/i.test(line.trim()));

  const ingredientsStart = lines.findIndex((line) => /^Ingredients:\s*$/i.test(line.trim()));
  const instructionsStart = lines.findIndex((line) => /^Instructions:\s*$/i.test(line.trim()));
  if (ingredientsStart < 0 || instructionsStart < 0 || instructionsStart <= ingredientsStart) return null;

  const ingredientLines = lines
    .slice(ingredientsStart + 1, instructionsStart)
    .map((line) => cleanText(line.replace(/^\s*-\s*/, "")))
    .filter(Boolean);
  const ingredients = ingredientLines.map(parseIngredientLine);

  const instructionTail = lines.slice(instructionsStart + 1);
  const instructionStop = instructionTail.findIndex((line) => /^(Notes:|Image:|Source:|Video:)\s*/i.test(line.trim()));
  const rawInstructionLines = instructionStop >= 0 ? instructionTail.slice(0, instructionStop) : instructionTail;
  const instructions = rawInstructionLines
    .map((line) => cleanText(line.replace(/^\s*\d+[.)]\s+/, "")))
    .filter(Boolean);
  const notesTail = notesStart >= 0 ? lines.slice(notesStart + 1) : [];
  const notesStop = notesTail.findIndex((line) => /^(Image:|Source:|Video:)\s*/i.test(line.trim()));
  const rawNotesLines = notesStart >= 0 ? (notesStop >= 0 ? notesTail.slice(0, notesStop) : notesTail) : [];
  const notes = rawNotesLines.map((line) => cleanText(line)).filter(Boolean).join("\n");

  return {
    name,
    tags: tagsLine
      ? tagsLine
          .replace(/^Tags:\s*/i, "")
          .split(",")
          .map((tag) => cleanText(tag))
          .filter(Boolean)
      : undefined,
    origin: originLine ? cleanText(originLine.replace(/^Origine:\s*/i, "")) : undefined,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    sourceUrl: sourceLine ? cleanText(sourceLine.replace(/^Source:\s*/i, "")) : undefined,
    videoUrl: videoLine ? cleanText(videoLine.replace(/^Video:\s*/i, "")) : undefined,
    imageUrl: imageLine ? cleanText(imageLine.replace(/^Image:\s*/i, "")) : undefined,
    notes: notes || undefined,
    servings,
    prepTime,
    restTime,
    cookTime,
    totalTime,
  };
}

function parseRecipeFromToquePayloadText(content: string): ParsedRecipe | null {
  const markerMatch = content.match(/--\s*TOQUE_RECIPE_V2\s*--\s*([\s\S]*?)\s*--\s*\/TOQUE_RECIPE_V2\s*--/i)?.[1];
  const linkMatch = content.match(/[#&?]toqueRecipe=([A-Za-z0-9\-_]+)/i)?.[1];
  const payload = (markerMatch ?? linkMatch ?? "").trim();
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (parsed.v !== 2 || typeof parsed.n !== "string") return null;

    const ingredients = Array.isArray(parsed.i)
      ? parsed.i
          .map((item) => {
            if (!Array.isArray(item)) return null;
            const name = cleanText(item[0]);
            if (!name) return null;
            return parseIngredientLine(cleanText(`${item[1] ?? ""} ${item[2] ?? ""} ${name} ${item[3] ?? ""}`));
          })
          .filter((item): item is ReturnType<typeof parseIngredientLine> => Boolean(item))
      : undefined;

    const instructions = Array.isArray(parsed.s) ? parsed.s.map((step) => cleanText(step)).filter(Boolean) : undefined;
    const sourceUrl = cleanText(parsed.u);
    const videoUrl = cleanText(parsed.vv);

    return {
      name: cleanText(parsed.n),
      tags: Array.isArray(parsed.t) ? parsed.t.map((tag) => cleanText(tag)).filter(Boolean) : undefined,
      origin: cleanText(parsed.o),
      ingredients: ingredients?.length ? ingredients : undefined,
      instructions: instructions?.length ? instructions : undefined,
      sourceUrl: sourceUrl || undefined,
      videoUrl: videoUrl || undefined,
      servings: numberValue(parsed.sv),
      prepTime: numberValue(parsed.pt),
      restTime: numberValue(parsed.rt),
      cookTime: numberValue(parsed.ct),
      totalTime: numberValue(parsed.tt),
      notes: cleanText(parsed.no),
      imageUrl: cleanText(parsed.im),
      imageUrls: Array.isArray(parsed.ims) ? parsed.ims.map((value) => cleanText(value)).filter(Boolean) : undefined,
      sourceImageUrl: cleanText(parsed.si),
      sourceImageUrls: Array.isArray(parsed.sis) ? parsed.sis.map((value) => cleanText(value)).filter(Boolean) : undefined,
      warnings: undefined,
    };
  } catch {
    return null;
  }
}

function parseRecipeFromJsonText(content: string): ParsedRecipe | null {
  if (!/^\s*[\[{]/.test(content)) return null;
  try {
    const parsed = JSON.parse(content) as unknown;
    const recipe = extractRecipeFromJsonPayload(parsed);
    if (!recipe) return null;

    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map((item) => ingredientFromJsonRecord(item))
          .filter((item): item is ReturnType<typeof parseIngredientLine> => Boolean(item))
      : undefined;
    const instructions = Array.isArray(recipe.instructions)
      ? recipe.instructions.map((step) => cleanText(step)).filter(Boolean)
      : undefined;

    return {
      name: cleanText(recipe.name),
      tags: Array.isArray(recipe.tags) ? recipe.tags.map((tag) => cleanText(tag)).filter(Boolean) : undefined,
      origin: cleanText(recipe.origin),
      ingredients: ingredients?.length ? ingredients : undefined,
      instructions: instructions?.length ? instructions : undefined,
      sourceUrl: cleanText(recipe.sourceUrl),
      videoUrl: cleanText(recipe.videoUrl),
      servings: numberValue(recipe.servings),
      prepTime: numberValue(recipe.prepTime),
      restTime: numberValue(recipe.restTime),
      cookTime: numberValue(recipe.cookTime),
      totalTime: numberValue(recipe.totalTime),
      notes: cleanText(recipe.notes),
      imageUrl: cleanText(recipe.imageUrl),
      imageUrls: Array.isArray(recipe.imageUrls) ? recipe.imageUrls.map((value) => cleanText(value)).filter(Boolean) : undefined,
      sourceImageUrl: cleanText(recipe.sourceImageUrl),
      sourceImageUrls: Array.isArray(recipe.sourceImageUrls) ? recipe.sourceImageUrls.map((value) => cleanText(value)).filter(Boolean) : undefined,
      warnings: undefined,
    };
  } catch {
    return null;
  }
}

function extractRecipeFromJsonPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.recipes) && record.recipes[0] && typeof record.recipes[0] === "object") {
    return record.recipes[0] as Record<string, unknown>;
  }
  if (typeof record.name === "string" && (Array.isArray(record.ingredients) || Array.isArray(record.instructions))) {
    return record;
  }
  return null;
}

function ingredientFromJsonRecord(item: unknown) {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = cleanText(record.name);
  if (!name) return null;
  return parseIngredientLine(cleanText(`${record.quantity ?? ""} ${record.unit ?? ""} ${name}`));
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function fetchRecipeHtmls(url: string): Promise<string[]> {
  const sources: string[] = [];

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/markdown,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    if (response.ok) sources.push(decodeResponseBody(await response.arrayBuffer()));
  } catch {
    // Continue with fallback proxies below.
  }

  const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(allOriginsUrl);
    if (response.ok) sources.push(decodeResponseBody(await response.arrayBuffer()));
  } catch {
    // Continue with last fallback.
  }

  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
  try {
    const response = await fetch(jinaUrl);
    if (response.ok) sources.push(decodeResponseBody(await response.arrayBuffer()));
  } catch {
    // Keep existing behavior: caller handles no-source case.
  }

  if (sources.length === 0) throw new Error("Unable to fetch source HTML");
  return sources;
}
