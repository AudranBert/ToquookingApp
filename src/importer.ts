import { CLOUD_CONFIG } from "./cloud/config";
import { getDefaultCloudServer, loadCloudDefaults, readCloudSettings } from "./cloud/settings";
import { defaultMarkdownFallback } from "./import/markdown";
import {
  parseRecipeFromJsonText,
  parseRecipeFromToquePayloadText,
  parseRecipeFromToqueShareText,
} from "./import/textRecipes";
import type { ParsedRecipe } from "./types";

/** URL imports are performed only by the configured Toquooking server. */
export async function importRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  await loadCloudDefaults();
  const settings = readCloudSettings();
  const apiUrl = settings.serverMode === "custom" ? settings.apiUrl : getDefaultCloudServer();
  if (!apiUrl) throw new Error("Import server unavailable");

  const response = await fetch(`${apiUrl}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(CLOUD_CONFIG.requestTimeoutMs),
  });
  const payload = (await response.json().catch(() => null)) as {
    recipe?: ParsedRecipe;
    error?: string;
  } | null;
  if (!response.ok || !payload?.recipe) {
    throw new Error(payload?.error || `Import failed (${response.status})`);
  }
  return payload.recipe;
}

/** Text and Toquooking payload imports stay local and work offline. */
export function importRecipeFromText(text: string): ParsedRecipe {
  const content = text.trim();
  if (!content) return { warnings: ["Colle un texte de recette pour lancer l’import."] };

  const structured =
    parseRecipeFromToquePayloadText(content) ??
    parseRecipeFromToqueShareText(content) ??
    parseRecipeFromJsonText(content);
  if (structured) return structured;

  const sourceUrl = content.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (/youtube\.com|youtu\.be/i.test(sourceUrl ?? "")) {
    return {
      sourceUrl,
      videoUrl: sourceUrl,
      name: "Recette YouTube",
      warnings: ["Import YouTube partiel : complète les ingrédients et les étapes manuellement."],
    };
  }

  return (
    defaultMarkdownFallback(content, sourceUrl ?? "https://import.local/text") ?? {
      sourceUrl,
      warnings: [
        "Import partiel depuis un texte non structuré. Vérifie les champs avant d’enregistrer.",
      ],
    }
  );
}
