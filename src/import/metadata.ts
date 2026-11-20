import { cleanText } from "./text";

export function parseDurationToMinutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const iso = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (iso) return Number(iso[1] || 0) * 24 * 60 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0);
  return parseDurationText(value);
}

export function parseDurationText(value: string) {
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

export function arrayify(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(arrayify).filter(Boolean);
  if (typeof value === "string" || typeof value === "number") {
    return String(value).split(/\n|;/).map(cleanText).filter(Boolean);
  }
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return arrayify(node.url ?? node.contentUrl ?? node.embedUrl ?? node.text ?? node.name);
  }
  return [];
}

export function metadataValues(recipe: Record<string, unknown>) {
  return [
    ...arrayify(recipe.keywords),
    ...arrayify(recipe.recipeCategory),
    ...arrayify(recipe.recipeCuisine),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function instructionText(item: unknown): string[] {
  if (typeof item === "string") return arrayify(item);
  if (!item || typeof item !== "object") return [];

  const node = item as Record<string, unknown>;
  const nested = node.itemListElement ?? node.steps ?? node.recipeInstructions;
  if (nested) {
    return arrayify(node.text ?? node.name).concat(
      Array.isArray(nested) ? nested.flatMap(instructionText) : instructionText(nested)
    );
  }

  return arrayify(node.text ?? node.name);
}

export function servings(value: unknown) {
  const first = arrayify(value)[0];
  if (!first) return undefined;
  return Number.parseInt(first, 10) || undefined;
}

export function recipeVideoUrl(recipe: Record<string, unknown>) {
  const firstVideo = Array.isArray(recipe.video) ? recipe.video[0] : recipe.video;
  return arrayify(firstVideo)[0];
}
