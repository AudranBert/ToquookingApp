import type { Ingredient, Recipe, RecipeDraft, ShoppingItem } from "../types";
import { createId } from "./id";
import { canonicalIngredientKey, formatIngredientName, ingredientSearchText, isPantryIngredient } from "./ingredients";
import { formatTagName } from "./tags";
import { normalizeText } from "./text";

export const emptyRecipeDraft: RecipeDraft = {
  name: "",
  tags: [],
  ingredients: [{ id: createId(), name: "" }],
  instructions: [""],
};

export function nowIso() {
  return new Date().toISOString();
}

export function createEmptyDraft(): RecipeDraft {
  return {
    ...emptyRecipeDraft,
    tags: [],
    ingredients: [{ id: createId(), name: "" }],
    instructions: [""],
  };
}

export function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    tags: recipe.tags,
    origin: recipe.origin,
    ingredients: recipe.ingredients.length ? recipe.ingredients : [{ id: createId(), name: "" }],
    instructions: recipe.instructions.length ? recipe.instructions : [""],
    sourceUrl: recipe.sourceUrl,
    videoUrl: recipe.videoUrl,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    restTime: recipe.restTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    notes: recipe.notes,
    imageUrl: recipe.imageUrl,
    imageUrls: recipe.imageUrls,
    sourceImageUrl: recipe.sourceImageUrl,
    sourceImageUrls: recipe.sourceImageUrls,
  };
}

export function cleanRecipeDraft(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    name: stripWrappingQuotes(draft.name.trim()) ?? "",
    tags: draft.tags.map((tag) => formatTagName(stripWrappingQuotes(tag.trim()) ?? "")).filter(Boolean),
    origin: stripWrappingQuotes(draft.origin?.trim()),
    ingredients: draft.ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: formatIngredientName(stripWrappingQuotes(ingredient.name.trim()) ?? ""),
        quantity: stripWrappingQuotes(ingredient.quantity?.trim()),
        unit: stripWrappingQuotes(ingredient.unit?.trim()),
        note: stripWrappingQuotes(ingredient.note?.trim()),
      }))
      .filter((ingredient) => ingredient.name),
    instructions: draft.instructions.map((step) => stripWrappingQuotes(step.trim()) ?? "").filter(Boolean),
    sourceUrl: stripWrappingQuotes(draft.sourceUrl?.trim()),
    videoUrl: stripWrappingQuotes(draft.videoUrl?.trim()),
    notes: stripWrappingQuotes(draft.notes?.trim()),
    imageUrl: stripWrappingQuotes(draft.imageUrl?.trim()),
    imageUrls: (draft.imageUrls ?? []).map((url) => stripWrappingQuotes(url?.trim()) ?? "").filter(Boolean),
    sourceImageUrl: stripWrappingQuotes(draft.sourceImageUrl?.trim()),
    sourceImageUrls: (draft.sourceImageUrls ?? []).map((url) => stripWrappingQuotes(url?.trim()) ?? "").filter(Boolean),
  };
}

export function cleanStoredRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ...cleanRecipeDraft(recipe),
  };
}

function stripWrappingQuotes(value: string | undefined) {
  if (!value) return value;
  const trimmed = value.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["â€œ", "â€"],
    ["â€˜", "â€™"],
    ["Â«", "Â»"],
    ["Ã¢â‚¬Å“", "Ã¢â‚¬Â"],
    ["Ã¢â‚¬Ëœ", "Ã¢â‚¬â„¢"],
    ["Ã‚Â«", "Ã‚Â»"],
  ];
  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end) && trimmed.length >= start.length + end.length) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim();
    }
  }
  return trimmed;
}

export function ingredientLabel(ingredient: Ingredient) {
  return [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.note && `(${ingredient.note})`]
    .filter(Boolean)
    .join(" ");
}

export function recipeMatchesQuery(recipe: Recipe, query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return true;

  const searchable = normalizeText(
    [
      recipe.name,
      recipe.origin ?? "",
      recipe.tags.join(" "),
      recipe.ingredients.map((ingredient) => ingredientSearchText(ingredient.name)).join(" "),
      recipe.instructions.join(" "),
    ].join(" "),
  );

  return searchable.includes(normalized);
}

export function buildShoppingList(recipes: Recipe[]) {
  const grouped = new Map<string, ShoppingItem>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = canonicalIngredientKey(ingredient.name);
      const label = ingredientLabel(ingredient);
      const existing = grouped.get(key);

      if (existing) {
        existing.label = existing.label.includes(label) ? existing.label : `${existing.label} + ${label}`;
        existing.recipeIds.push(recipe.id);
        return;
      }

      grouped.set(key, {
        id: createId(),
        label,
        checked: false,
        recipeIds: [recipe.id],
        pantry: isPantryIngredient(ingredient),
      });
    });
  });

  return [...grouped.values()].sort((a, b) => Number(a.pantry) - Number(b.pantry) || a.label.localeCompare(b.label, "fr"));
}
