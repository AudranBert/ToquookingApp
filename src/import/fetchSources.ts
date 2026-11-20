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

  const jinaHttpsUrl = `https://r.jina.ai/https://${url.replace(/^https?:\/\//i, "")}`;
  try {
    const response = await fetch(jinaHttpsUrl);
    if (response.ok) sources.push(decodeResponseBody(await response.arrayBuffer()));
  } catch {
    // Keep existing behavior: caller handles no-source case.
  }

  if (sources.length === 0) throw new Error("Unable to fetch source HTML");
  const nonBlocked = sources.filter((source) => !isLikelyAntiBotPage(source));
  return nonBlocked.length > 0 ? nonBlocked : sources;
}

function isLikelyAntiBotPage(content: string) {
  const text = cleanText(content).toLowerCase();
  return (
    text.startsWith("just a moment") ||
    /cloudflare|cf-ray|cf-chl-|attention required|checking your browser/.test(text)
  );
}
