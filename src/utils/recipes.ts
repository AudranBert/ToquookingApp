import { normalizeText } from "../seasonal";
import type { Ingredient, Recipe, RecipeDraft, ShoppingItem } from "../types";
import { createId } from "./id";

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
    ingredients: recipe.ingredients.length ? recipe.ingredients : [{ id: createId(), name: "" }],
    instructions: recipe.instructions.length ? recipe.instructions : [""],
    sourceUrl: recipe.sourceUrl,
    videoUrl: recipe.videoUrl,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    notes: recipe.notes,
    imageUrl: recipe.imageUrl,
  };
}

export function cleanRecipeDraft(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    ingredients: draft.ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity?.trim(),
        unit: ingredient.unit?.trim(),
        note: ingredient.note?.trim(),
      }))
      .filter((ingredient) => ingredient.name),
    instructions: draft.instructions.map((step) => step.trim()).filter(Boolean),
    sourceUrl: draft.sourceUrl?.trim(),
    videoUrl: draft.videoUrl?.trim(),
    notes: draft.notes?.trim(),
    imageUrl: draft.imageUrl?.trim(),
  };
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
      recipe.tags.join(" "),
      recipe.ingredients.map((ingredient) => ingredient.name).join(" "),
      recipe.instructions.join(" "),
    ].join(" "),
  );

  return searchable.includes(normalized);
}

export function buildShoppingList(recipes: Recipe[]) {
  const grouped = new Map<string, ShoppingItem>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = normalizeText(ingredient.name);
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
      });
    });
  });

  return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
