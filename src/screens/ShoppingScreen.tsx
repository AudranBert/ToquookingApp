import type { Dispatch, SetStateAction } from "react";
import { Plus, ShoppingBasket } from "lucide-react";
import type { Recipe, ShoppingItem } from "../types";

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
          {recipes.map((recipe) => (
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
        </div>

        <div className="stack">
          {items.map((item) => (
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
            </label>
          ))}
          <button className="button button--ghost button--full" onClick={onAddItem}>
            <Plus size={18} /> Ajouter une ligne
          </button>
        </div>
      </div>
    </section>
  );
}
