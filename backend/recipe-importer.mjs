import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

const entities = { amp: "&", apos: "'", quot: '"', nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç" };

function decodeEntities(value = "") {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    const key = code.toLowerCase();
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return entities[key] ?? match;
  });
}

function clean(value) {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values).filter(Boolean);
  if (typeof value === "string" || typeof value === "number") return [clean(value)].filter(Boolean);
  if (value && typeof value === "object") return values(value.url ?? value.contentUrl ?? value.embedUrl ?? value.text ?? value.name);
  return [];
}

function minutes(value) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (iso) return Number(iso[1] || 0) * 1440 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0) || undefined;
  const hours = Number(value.match(/(\d+)\s*h/i)?.[1] ?? 0);
  const mins = Number(value.match(/(\d+)\s*(?:min|mn)/i)?.[1] ?? 0);
  return hours * 60 + mins || undefined;
}

function ingredient(line) {
  const text = clean(line);
  const match = text.match(/^(\d+(?:[,.]\d+)?|[¼½¾⅓⅔])\s+(.+)$/);
  if (!match) return { id: randomUUID(), name: text };
  const unitMatch = match[2].match(/^(kg|g|l|cl|ml|c\.\s*à\s*(?:soupe|café)|cuillères?\s+à\s+(?:soupe|café)|gousses?|pincées?|sachets?|tranches?)\b\s*/i);
  return {
    id: randomUUID(),
    quantity: match[1],
    ...(unitMatch ? { unit: unitMatch[1] } : {}),
    name: clean(match[2].slice(unitMatch?.[0].length ?? 0).replace(/^(?:de |du |des |d['’])+/i, "")),
  };
}

function instructionLines(value) {
  if (Array.isArray(value)) return value.flatMap(instructionLines).filter(Boolean);
  if (typeof value === "string") return value.split(/\n+/).map(clean).filter(Boolean);
  if (!value || typeof value !== "object") return [];
  return [...values(value.text ?? value.name), ...instructionLines(value.itemListElement ?? value.steps)];
}

function findRecipe(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  const type = value["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return value;
  return findRecipe(value["@graph"]);
}

function absoluteUrl(value, sourceUrl) {
  if (!value) return undefined;
  try { return new URL(value, sourceUrl).href; } catch { return undefined; }
}

function fromJsonLd(html, sourceUrl) {
  const scripts = html.matchAll(/<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    for (const body of [match[1], decodeEntities(match[1])]) {
      try {
        const recipe = findRecipe(JSON.parse(body));
        if (!recipe) continue;
        const ingredients = values(recipe.recipeIngredient).map(ingredient);
        const instructions = instructionLines(recipe.recipeInstructions);
        return {
          sourceUrl,
          name: values(recipe.name)[0],
          imageUrl: absoluteUrl(values(recipe.image)[0], sourceUrl),
          videoUrl: absoluteUrl(values(recipe.video)[0], sourceUrl),
          tags: [...values(recipe.keywords), ...values(recipe.recipeCategory)],
          ingredients: ingredients.length ? ingredients : undefined,
          instructions: instructions.length ? instructions : undefined,
          servings: Number.parseInt(values(recipe.recipeYield)[0], 10) || undefined,
          prepTime: minutes(recipe.prepTime),
          restTime: minutes(recipe.restTime ?? recipe.restingTime),
          cookTime: minutes(recipe.cookTime),
          totalTime: minutes(recipe.totalTime),
        };
      } catch { /* Try the next JSON-LD block. */ }
    }
  }
  return null;
}

function collectSection(lines, header, otherHeader) {
  const start = lines.findIndex((line) => header.test(line.trim()));
  if (start < 0) return [];
  const result = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if ((otherHeader.test(trimmed) || /^#{1,6}\s+/.test(trimmed)) && result.length) break;
    const item = clean(trimmed.replace(/^[-*+]\s+|^\d+[.)]\s+/, ""));
    if (item) result.push(item);
  }
  return result.slice(0, 50);
}

function fromReadableText(content, sourceUrl) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const ingredientsHeader = /^(?:#{1,6}\s*)?(?:les\s+)?ingr[eé]dients?\s*:?$/i;
  const instructionsHeader = /^(?:#{1,6}\s*)?(?:instructions?|[eé]tapes?|pr[eé]paration|m[eé]thode)\s*:?$/i;
  const ingredients = collectSection(lines, ingredientsHeader, instructionsHeader).map(ingredient);
  const instructions = collectSection(lines, instructionsHeader, ingredientsHeader);
  if (!ingredients.length && !instructions.length) return null;
  const name = clean(content.match(/^\s*(?:Title:|#)\s*(.+)$/im)?.[1] ?? "");
  const image = content.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? content.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/i)?.[1];
  return {
    sourceUrl,
    name: name || undefined,
    imageUrl: absoluteUrl(image, sourceUrl),
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    warnings: ["Import partiel : vérifie les ingrédients et les étapes avant d’enregistrer."],
  };
}

function isPrivateAddress(address) {
  if (address.includes(":")) return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb");
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function assertPublicUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("URL invalide"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("URL invalide");
  if (isIP(url.hostname) ? isPrivateAddress(url.hostname) : (await lookup(url.hostname, { all: true })).some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Adresse privée interdite");
  }
  return url;
}

function parseSourceUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("URL invalide"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("URL invalide");
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error("Adresse privée interdite");
  return url;
}

async function fetchPage(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Toquooking/1.0 recipe importer", accept: "text/html,text/plain,text/markdown;q=0.9" },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = await assertPublicUrl(new URL(response.headers.get("location"), url).href);
      continue;
    }
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_PAGE_BYTES) throw new Error("Page trop volumineuse");
    return new TextDecoder().decode(bytes);
  }
  throw new Error("Trop de redirections");
}

export async function importRecipeFromUrl(rawUrl) {
  const url = parseSourceUrl(rawUrl).href;
  if (/youtu\.be|youtube\.com/i.test(new URL(url).hostname)) {
    return { sourceUrl: url, videoUrl: url, name: "Recette YouTube", warnings: ["Import YouTube partiel : complète les ingrédients et les étapes manuellement."] };
  }
  try {
    const content = await fetchPage(url);
    const structured = fromJsonLd(content, url);
    if (structured?.ingredients?.length || structured?.instructions?.length) return structured;
    const fallback = fromReadableText(content, url);
    if (fallback) return fallback;
  } catch {
    /* Return a useful partial result when the source blocks the server. */
  }
  return { sourceUrl: url, warnings: ["Aucune recette exploitable détectée. Complète la fiche manuellement."] };
}
