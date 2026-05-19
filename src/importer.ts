import type { ParsedRecipe } from "./types";

function guessRecipeNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "";
    const cleanedSlug = decodeURIComponent(slug)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanedSlug.length >= 3) return cleanedSlug;
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const endpoint = `/api/import?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    if (response.ok) return response.json();
  } catch {
    // Static builds do not always have the backend endpoint.
  } finally {
    window.clearTimeout(timer);
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    return {
      sourceUrl: url,
      videoUrl: url,
      name: "Recette YouTube",
      warnings: ["Import YouTube partiel: verifie le titre, les ingredients et les etapes manuellement."],
    };
  }

  const fallbackName = guessRecipeNameFromUrl(url);
  return {
    name: fallbackName || undefined,
    sourceUrl: url,
    warnings: [
      "Import avance indisponible hors backend. Le lien est conserve, complete la recette manuellement ou reessaie en ligne.",
    ],
  };
}
