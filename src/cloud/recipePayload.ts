import type { Recipe } from "../types";
import { mergedRecipeImageUrls, primaryRecipeImageUrl } from "../utils/images";

/** Keep the visible cover once; original and additional images stay local. */
export function toCloudRecipe(recipe: Recipe): Recipe {
  const payload = { ...recipe, imageUrl: primaryRecipeImageUrl(recipe) };
  delete payload.imageUrls;
  delete payload.sourceImageUrl;
  delete payload.sourceImageUrls;
  return payload;
}

/** A cloud update must not erase photos which are intentionally local-only. */
export function preserveLocalImages(recipe: Recipe, local?: Recipe): Recipe {
  if (!local) return recipe;
  const images = mergedRecipeImageUrls({
    imageUrl: primaryRecipeImageUrl(recipe),
    imageUrls: mergedRecipeImageUrls(local),
  });
  return {
    ...recipe,
    imageUrl: images[0],
    imageUrls: images,
    sourceImageUrl: local.sourceImageUrl,
    sourceImageUrls: local.sourceImageUrls,
  };
}
