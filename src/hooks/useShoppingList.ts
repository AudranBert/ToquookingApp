import { useEffect, useState } from "react";
import type { Recipe, ShoppingItem } from "../types";
import { createId } from "../utils/id";
import { buildShoppingList } from "../utils/shoppingList";
import type { StatusApi } from "./useStatus";
import { t } from "../i18n";

const STORAGE_KEY = "toque.shopping-list";

function readShoppingList(): { selectedIds: string[]; items: ShoppingItem[] } {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      stored &&
      Array.isArray(stored.selectedIds) &&
      stored.selectedIds.every((id: unknown) => typeof id === "string") &&
      Array.isArray(stored.items) &&
      stored.items.every(
        (item: ShoppingItem) =>
          item &&
          typeof item.id === "string" &&
          typeof item.label === "string" &&
          typeof item.checked === "boolean" &&
          Array.isArray(item.recipeIds) &&
          item.recipeIds.every((id) => typeof id === "string")
      )
    )
      return stored;
  } catch {
    /* An unavailable or invalid local store must not prevent manual use. */
  }
  return { selectedIds: [], items: [] };
}

export function useShoppingList(recipes: Recipe[], status: StatusApi) {
  const { setStatus } = status;
  const [initial] = useState(readShoppingList);
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds);
  const [items, setItems] = useState(initial.items);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedIds, items }));
    } catch {
      setStatus(t("shopping.status.storageFailed"));
    }
  }, [selectedIds, items, setStatus]);

  function regenerate() {
    const selected = recipes.filter((recipe) => selectedIds.includes(recipe.id));
    setItems((current) => {
      const manualItems = current.filter((item) => item.recipeIds.length === 0);
      const generated = buildShoppingList(selected).map((item) => {
        const previous = current.find(
          (candidate) => candidate.recipeIds.length > 0 && candidate.label === item.label
        );
        return previous ? { ...item, id: previous.id, checked: previous.checked } : item;
      });
      return [...generated, ...manualItems];
    });
    status.setStatus(t("shopping.status.generated"));
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { id: createId(), label: t("shopping.item.new"), checked: false, recipeIds: [] },
    ]);
  }

  return { selectedIds, setSelectedIds, items, setItems, regenerate, addItem };
}
