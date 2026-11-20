import { CLOUD_CONFIG } from "./config";
import type { Recipe } from "../types";
import { parseCloudRecipe } from "./validation";
import { cloudRequest } from "./apiClient";
import { toCloudRecipe } from "./recipePayload";
import {
  generateCloudKey,
  normalizeApiUrl,
  readCloudSettings,
  writeCloudSettings,
} from "./settings";

export async function createCloudShare(recipe: Recipe) {
  let settings = readCloudSettings();
  if (settings.apiUrl && !settings.key)
    settings = writeCloudSettings({ ...settings, key: generateCloudKey() });
  const { shareId } = await cloudRequest<{ shareId: string }>("/shares", {
    method: "POST",
    settings,
    body: { recipe: toCloudRecipe(recipe) },
  });
  const url = new URL(window.location.href);
  url.search = "";
  // The public endpoint travels with the link so recipients need no setup.
  // The private cloud key is NEVER included.
  url.hash = new URLSearchParams({ share: shareId, server: settings.apiUrl }).toString();
  return url.toString();
}

export async function readCloudShareFromLocation(): Promise<Recipe | null> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const id = params.get("share");
  if (!id) return null;
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid share");
  const server = normalizeApiUrl(params.get("server") || readCloudSettings().apiUrl);
  if (!server) throw new Error("Missing server");
  const response = await fetch(`${server}/shares/${id}`, {
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(CLOUD_CONFIG.requestTimeoutMs),
  });
  if (!response.ok) throw new Error("Share unavailable");
  const { recipe } = await response.json();
  return parseCloudRecipe(recipe);
}
