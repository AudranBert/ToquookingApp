import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Plus, Search, ShoppingBasket } from "lucide-react";
import type { Recipe, ShoppingItem } from "../types";
import { normalizeText } from "../utils/text";

type Props = {
  recipes: Recipe[];
  selectedRecipeIds: string[];
  items: ShoppingItem[];
  onAddItem: () => void;
  onGenerate: () => void;
  onItemChange: Dispatch<SetStateAction<ShoppingItem[]>>;
  onSelectionChange: Dispatch<SetStateAction<string[]>>;
};

export function ShoppingScreen({
  recipes,
  selectedRecipeIds,
  items,
  onAddItem,
  onGenerate,
  onItemChange,
  onSelectionChange,
}: Props) {
  const [recipeQuery, setRecipeQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");

  const normalizedRecipeQuery = normalizeText(recipeQuery);
  const normalizedItemQuery = normalizeText(itemQuery);

  const visibleRecipes = useMemo(
    () =>
      normalizedRecipeQuery
        ? recipes.filter((recipe) =>
            normalizeText([recipe.name, recipe.origin, ...recipe.tags].filter(Boolean).join(" ")).includes(
              normalizedRecipeQuery,
            ),
          )
        : recipes,
    [normalizedRecipeQuery, recipes],
  );

  const visibleItems = useMemo(
    () =>
      normalizedItemQuery
        ? items.filter((item) => normalizeText(item.label).includes(normalizedItemQuery))
        : items,
    [items, normalizedItemQuery],
  );

  return (
    <section className="panel workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Liste de courses</span>
          <h2>Sélectionne des recettes</h2>
        </div>
        <button className="button button--primary" onClick={onGenerate}>
          <ShoppingBasket size={18} /> Générer
        </button>
      </div>

      <div className="layout layout--split">
        <div className="stack">
          <label className="search-field">
            <span className="label-with-icon">
              <Search size={16} /> Rechercher une recette
            </span>
            <input
              aria-label="Rechercher une recette pour la liste de courses"
              placeholder="Nom, origine, tag..."
              type="search"
              value={recipeQuery}
              onChange={(event) => setRecipeQuery(event.target.value)}
            />
          </label>
          <span className="muted count-label">
            {visibleRecipes.length} / {recipes.length} recettes
          </span>

          {visibleRecipes.map((recipe) => (
            <label key={recipe.id} className="check-control">
              <input
                checked={selectedRecipeIds.includes(recipe.id)}
                onChange={(event) =>
                  onSelectionChange((ids) =>
                    event.target.checked ? [...ids, recipe.id] : ids.filter((id) => id !== recipe.id),
                  )
                }
                type="checkbox"
              />
              {recipe.name}
            </label>
          ))}
          {visibleRecipes.length === 0 && <p className="empty-inline">Aucune recette ne correspond.</p>}
        </div>

        <div className="stack">
          <label className="search-field">
            <span className="label-with-icon">
              <Search size={16} /> Rechercher dans la liste
            </span>
            <input
              aria-label="Rechercher une ligne de course"
              placeholder="Ingrédient..."
              type="search"
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
            />
          </label>
          <span className="muted count-label">
            {visibleItems.length} / {items.length} lignes
          </span>

          {visibleItems.map((item) => (
            <label key={item.id} className={item.checked ? "shopping-item shopping-item--done" : "shopping-item"}>
              <input
                checked={item.checked}
                onChange={(event) =>
                  onItemChange((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, checked: event.target.checked } : candidate,
                    ),
                  )
                }
                type="checkbox"
              />
              <input
                aria-label="Ligne de course"
                value={item.label}
                onChange={(event) =>
                  onItemChange((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate,
                    ),
                  )
                }
              />
              {item.pantry && <span className="chip chip--pantry">Placard</span>}
            </label>
          ))}
          {items.length > 0 && visibleItems.length === 0 && <p className="empty-inline">Aucune ligne ne correspond.</p>}
          <button className="button button--ghost button--full" onClick={onAddItem}>
            <Plus size={18} /> Ajouter une ligne
          </button>
        </div>
      </div>
    </section>
  );
}
