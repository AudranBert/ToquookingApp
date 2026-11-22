import type { ParsedRecipe, RecipeDraft } from "../types";
import { createEmptyDraft } from "../utils/recipes";
import { createId } from "../utils/id";
import { mergedRecipeImageUrls } from "../utils/images";
import { normalizeText } from "../utils/text";

export function parsedToDraft(
  parsed: ParsedRecipe,
  fallbackUrl: string,
  allTags: string[]
): RecipeDraft {
  const imageUrl = parsed.imageUrl;
  const imageUrls = mergedRecipeImageUrls({ imageUrl, imageUrls: parsed.imageUrls });

  return {
    ...createEmptyDraft(),
    ...parsed,
    sourceUrl: parsed.sourceUrl ?? fallbackUrl,
    videoUrl: parsed.videoUrl,
    imageUrl,
    imageUrls,
    sourceImageUrl: imageUrl,
    sourceImageUrls: imageUrls,
    tags: matchKnownTags(parsed.tags ?? [], allTags),
    ingredients: parsed.ingredients?.length ? parsed.ingredients : [{ id: createId(), name: "" }],
    instructions: parsed.instructions?.length ? parsed.instructions : [""],
  };
}

export function matchKnownTags(importedTags: string[], allTags: string[]) {
  const known = new Map(allTags.map((tag) => [normalizeText(tag), tag]));
  const matched = new Map<string, string>();
  importedTags.forEach((tag) => {
    const exact = known.get(normalizeText(tag));
    if (exact) matched.set(normalizeText(exact), exact);
  });
  return [...matched.values()];
}
