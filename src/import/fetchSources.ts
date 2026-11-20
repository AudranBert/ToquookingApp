import { cleanText } from "./text";

export function sourceTextQualityScore(value: string) {
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  const mojibake = (value.match(/[ÃÂâï¿]/g) ?? []).length;
  const recipeSignals = (
    value.match(/recipeIngredient|recipeInstructions|itemprop=["']recipe/i) ?? []
  ).length;
  return recipeSignals * 20 - replacement * 8 - mojibake * 3;
}

export function isAcceptableMarmitonSource(value: string) {
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  const signal = (
    value.match(
      /recipe-step-list__container|Mrtn\.recipesData|application\/ld\+json|recipeIngredient|recipeInstructions/gi
    ) ?? []
  ).length;
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

export async function fetchRecipeHtmls(url: string): Promise<string[]> {
  const candidates = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`,
    `https://r.jina.ai/https://${url.replace(/^https?:\/\//i, "")}`,
  ];
  const results = await Promise.allSettled(candidates.map(async (source) => {
    const response = await fetch(source, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "text/html,application/xhtml+xml,text/markdown,text/plain;q=0.9,*/*;q=0.8" },
    });
    if (!response.ok) return "";
    const content = decodeResponseBody(await response.arrayBuffer());
    return isUnavailableRecipePage(content) ? "" : content;
  }));
  const sources = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);

  if (sources.length === 0) throw new Error("Unable to fetch source HTML");
  const nonBlocked = sources.filter((source) => !isLikelyAntiBotPage(source));
  return nonBlocked.length > 0 ? nonBlocked : sources;
}

// A proxy may return HTTP 200 while its body is the source site's error page.
export function isUnavailableRecipePage(content: string) {
  const title = cleanText(content.match(/^\s*Title:\s*(.+)$/im)?.[1] ?? content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return /^(?:404\b|403\b|page (?:non trouvée|introuvable)|not found|access denied|just a moment\b)/i.test(title) ||
    /(?:\/Home\/error\/404|Warning: Target URL returned error (?:404|403)|Cuisine Actuelle\s*:\s*toutes vos recettes de cuisine)/i.test(title) ||
    /(?:\/Home\/error\/404|Warning: Target URL returned error (?:404|403))/i.test(content);
}

function isLikelyAntiBotPage(content: string) {
  const text = cleanText(content).toLowerCase();
  return (
    text.startsWith("just a moment") ||
    /cloudflare|cf-ray|cf-chl-|attention required|checking your browser/.test(text)
  );
}
