import { useMemo } from "react";
import { db } from "../db";
import { t } from "../i18n";
import type { Recipe } from "../types";
import { nowIso } from "../utils/recipes";
import { normalizeText } from "../utils/text";
import type { StatusApi } from "./useStatus";

export type IngredientUsage = {
  name: string;
  usageCount: number;
};

export function useIngredientsManagement(recipes: Recipe[], status: StatusApi, onRecipesChanged: () => Promise<unknown>) {
  const allIngredients = useMemo(() => {
    const aggregate = new Map<string, IngredientUsage>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        const name = ingredient.name.trim();
        if (!name) return;
        const key = normalizeText(name);
        const current = aggregate.get(key);
        if (current) {
          current.usageCount += 1;
        } else {
          aggregate.set(key, { name, usageCount: 1 });
        }
      });
    });
    return [...aggregate.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [recipes]);

  async function renameIngredient(oldName: string, newNameRaw: string) {
    const newName = newNameRaw.trim();
    if (!newName || normalizeText(oldName) === normalizeText(newName)) return;
    const oldKey = normalizeText(oldName);

    const affected = recipes.filter((recipe) => recipe.ingredients.some((ingredient) => normalizeText(ingredient.name) === oldKey));
    if (affected.length === 0) return;

    await db.recipes.bulkPut(
      affected.map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) =>
          normalizeText(ingredient.name) === oldKey ? { ...ingredient, name: newName } : ingredient,
        ),
        updatedAt: nowIso(),
      })),
    );
    await onRecipesChanged();
    status.setStatus(t("manage.status.ingredientRenamed"));
  }

  async function mergeIngredients(sourceName: string, targetNameRaw: string) {
    await renameIngredient(sourceName, targetNameRaw);
    status.setStatus(t("manage.status.ingredientsMerged"));
  }

  async function deleteIngredient(name: string) {
    const key = normalizeText(name);
    const affected = recipes.filter((recipe) => recipe.ingredients.some((ingredient) => normalizeText(ingredient.name) === key));
    if (affected.length === 0) return;
    await db.recipes.bulkPut(
      affected.map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.filter((ingredient) => normalizeText(ingredient.name) !== key),
        updatedAt: nowIso(),
      })),
    );
    await onRecipesChanged();
    status.setStatus(t("manage.status.ingredientDeletedFromRecipes"));
  }

  return { allIngredients, renameIngredient, mergeIngredients, deleteIngredient };
}
