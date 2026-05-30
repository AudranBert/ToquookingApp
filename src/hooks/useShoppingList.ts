import { useState } from "react";
import type { Recipe, ShoppingItem } from "../types";
import { createId } from "../utils/id";
import { buildShoppingList } from "../utils/recipes";
import type { StatusApi } from "./useStatus";

export function useShoppingList(recipes: Recipe[], status: StatusApi) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);

  function regenerate() {
    const selected = recipes.filter((recipe) => selectedIds.includes(recipe.id));
    setItems((current) => {
      const manualItems = current.filter((item) => item.recipeIds.length === 0);
      return [...buildShoppingList(selected), ...manualItems];
    });
    status.setStatus("Liste de courses générée.");
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { id: createId(), label: "Nouvel ingrédient", checked: false, recipeIds: [] },
    ]);
  }

  return { selectedIds, setSelectedIds, items, setItems, regenerate, addItem };
}
