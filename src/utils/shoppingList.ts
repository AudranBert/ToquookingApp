import type { Recipe, ShoppingItem } from "../types";
import { createId } from "./id";
import { canonicalIngredientKey, isPantryIngredient } from "./ingredients";
import { ingredientLabel } from "./recipes";

export function buildShoppingList(recipes: Recipe[]) {
  const grouped = new Map<string, ShoppingItem>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = canonicalIngredientKey(ingredient.name);
      const label = ingredientLabel(ingredient);
      const existing = grouped.get(key);

      if (existing) {
        existing.label = existing.label.includes(label)
          ? existing.label
          : `${existing.label} + ${label}`;
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

  return [...grouped.values()].sort(
    (a, b) => Number(a.pantry) - Number(b.pantry) || a.label.localeCompare(b.label, "fr")
  );
}
