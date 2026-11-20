import type { ParsedRecipe } from "../types";
import { isLikelyRecipeImage } from "./images";

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
  return lines.reduce((count, line) => count + (line.match(/�/g) ?? []).length, 0);
}

export function mergeRecipes(base: ParsedRecipe | null, incoming: ParsedRecipe): ParsedRecipe {
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
    name: base.name?.trim() && !/^noname$/i.test(base.name.trim()) ? base.name : incoming.name,
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
