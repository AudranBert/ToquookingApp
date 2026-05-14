import type { Dispatch, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import { FileDown, FileText, ImageDown, Plus, Search, ShoppingBasket } from "lucide-react";
import { basicFileName, exportElementAsPdf, exportElementAsPng, exportTextFile } from "../exporters";
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
  onStatus: (message: string) => void;
};

export function ShoppingScreen({
  recipes,
  selectedRecipeIds,
  items,
  onAddItem,
  onGenerate,
  onItemChange,
  onSelectionChange,
  onStatus,
}: Props) {
  const [recipeQuery, setRecipeQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

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
  const selectedRecipes = useMemo(
    () => recipes.filter((recipe) => selectedRecipeIds.includes(recipe.id)),
    [recipes, selectedRecipeIds],
  );
  const exportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
  const exportFilename = basicFileName("liste de courses", "txt").replace(".txt", "");
  const canExport = items.length > 0;

  async function handleExportText() {
    if (!canExport) return;
    exportTextFile(formatShoppingListText(items, selectedRecipes, exportDate), `${exportFilename}.txt`);
    onStatus("Liste de courses telechargee en texte.");
  }

  async function handleExportImage() {
    if (!exportRef.current || !canExport) return;
    try {
      await exportElementAsPng(exportRef.current, `${exportFilename}.png`);
      onStatus("Image de la liste de courses telechargee.");
    } catch {
      onStatus("L'export image n'a pas abouti.");
    }
  }

  async function handleExportPdf() {
    if (!exportRef.current || !canExport) return;
    try {
      await exportElementAsPdf(exportRef.current, `${exportFilename}.pdf`);
      onStatus("PDF de la liste de courses telecharge.");
    } catch {
      onStatus("L'export PDF n'a pas abouti.");
    }
  }

  return (
    <section className="panel workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Liste de courses</span>
          <h2>Sélectionne des recettes</h2>
        </div>
        <div className="action-bar">
          <button className="button" onClick={handleExportText} disabled={!canExport} title="Exporter en texte">
            <FileText size={18} /> Texte
          </button>
          <button className="button" onClick={handleExportImage} disabled={!canExport} title="Exporter en image PNG">
            <ImageDown size={18} /> Image
          </button>
          <button className="button" onClick={handleExportPdf} disabled={!canExport} title="Exporter en PDF">
            <FileDown size={18} /> PDF
          </button>
          <button className="button button--primary" onClick={onGenerate}>
            <ShoppingBasket size={18} /> Générer
          </button>
        </div>
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

      <div className="shopping-export-canvas" aria-hidden="true">
        <div className="shopping-export-sheet" ref={exportRef}>
          <div className="shopping-export-sheet__header">
            <span className="eyebrow">{exportDate}</span>
            <h2>Liste de courses</h2>
          </div>
          {selectedRecipes.length > 0 && (
            <div className="shopping-export-sheet__recipes">
              <h3>Recettes</h3>
              <p>{selectedRecipes.map((recipe) => recipe.name).join(", ")}</p>
            </div>
          )}
          <div className="shopping-export-sheet__items">
            {items.map((item) => (
              <div key={item.id} className="shopping-export-row">
                <span className="shopping-export-row__check">{item.checked ? "x" : ""}</span>
                <span
                  className={
                    item.checked
                      ? "shopping-export-row__label shopping-export-row__label--done"
                      : "shopping-export-row__label"
                  }
                >
                  {item.label}
                </span>
                {item.pantry && <span className="chip chip--pantry">Placard</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatShoppingListText(items: ShoppingItem[], recipes: Recipe[], exportDate: string) {
  const lines = ["Liste de courses", exportDate, ""];

  if (recipes.length > 0) {
    lines.push("Recettes:", ...recipes.map((recipe) => `- ${recipe.name}`), "");
  }

  lines.push("Courses:");
  items.forEach((item) => {
    lines.push(`${item.checked ? "[x]" : "[ ]"} ${item.label}${item.pantry ? " (Placard)" : ""}`);
  });

  return `${lines.join("\n")}\n`;
}
