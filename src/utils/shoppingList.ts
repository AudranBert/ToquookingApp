import type { Ingredient, Recipe, ShoppingItem } from "../types";
import { createId } from "./id";
import { canonicalIngredientKey, isPantryIngredient } from "./ingredients";
import { ingredientLabel } from "./recipes";
import { parseQuantity, formatQuantity } from "./quantities";
import { normalizeText } from "./text";

export function buildShoppingList(recipes: Recipe[]) {
  const grouped = new Map<string, ShoppingItem>();
  const contributions = new Map<string, Ingredient[]>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = canonicalIngredientKey(ingredient.name);
      if (!key) return;
      const parts = contributions.get(key) ?? [];
      const quantity = parseQuantity(ingredient.quantity);
      const compatible =
        quantity === undefined
          ? undefined
          : parts.find(
              (part) =>
                parseQuantity(part.quantity) !== undefined &&
                normalizeText(part.unit ?? "") === normalizeText(ingredient.unit ?? "") &&
                normalizeText(part.note ?? "") === normalizeText(ingredient.note ?? "")
            );
      if (compatible)
        compatible.quantity = formatQuantity(parseQuantity(compatible.quantity)! + quantity!);
      else parts.push({ ...ingredient });
      contributions.set(key, parts);
      const label = parts.map(ingredientLabel).join(" + ");
      const existing = grouped.get(key);

      if (existing) {
        existing.label = label;
        if (!existing.recipeIds.includes(recipe.id)) existing.recipeIds.push(recipe.id);
        existing.pantry = existing.pantry && isPantryIngredient(ingredient);
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
