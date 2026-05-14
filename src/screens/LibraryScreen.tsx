import type { RefObject } from "react";
import { Filter, Link, Plus, Search } from "lucide-react";
import { RecipeDetail } from "../components/RecipeDetail";
import type { Recipe } from "../types";

type Props = {
  allTags: string[];
  filteredRecipes: Recipe[];
  importUrl: string;
  query: string;
  selectedRecipe?: Recipe;
  seasonalOnly: boolean;
  tagFilter: string;
  printRef: RefObject<HTMLDivElement>;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onExport: (format: "pdf" | "png") => void;
  onImport: () => void;
  onImportUrlChange: (url: string) => void;
  onNewRecipe: () => void;
  onQueryChange: (query: string) => void;
  onSeasonalOnlyChange: (enabled: boolean) => void;
  onSelectRecipe: (id: string) => void;
  onTagFilterChange: (tag: string) => void;
};

export function LibraryScreen({
  allTags,
  filteredRecipes,
  importUrl,
  query,
  selectedRecipe,
  seasonalOnly,
  tagFilter,
  printRef,
  onDelete,
  onDuplicate,
  onEdit,
  onExport,
  onImport,
  onImportUrlChange,
  onNewRecipe,
  onQueryChange,
  onSeasonalOnlyChange,
  onSelectRecipe,
  onTagFilterChange,
}: Props) {
  return (
    <section className="layout layout--library">
      <aside className="panel sidebar">
        <div className="field-group">
          <label htmlFor="import-url">Importer depuis un lien</label>
          <div className="inline-control">
            <input
              id="import-url"
              value={importUrl}
              onChange={(event) => onImportUrlChange(event.target.value)}
              placeholder="Marmiton, CuisineAZ, YouTube..."
            />
            <button className="button button--icon" onClick={onImport} title="Importer">
              <Link size={18} />
            </button>
          </div>
        </div>

        <button className="button button--primary button--full" onClick={onNewRecipe}>
          <Plus size={18} /> Nouvelle recette
        </button>

        <div className="filters">
          <label>
            <span className="label-with-icon">
              <Search size={16} /> Rechercher
            </span>
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Nom, ingrédient, tag" />
          </label>
          <label>
            <span className="label-with-icon">
              <Filter size={16} /> Tag
            </span>
            <select value={tagFilter} onChange={(event) => onTagFilterChange(event.target.value)}>
              <option value="">Tous les tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="check-control">
            <input checked={seasonalOnly} onChange={(event) => onSeasonalOnlyChange(event.target.checked)} type="checkbox" />
            <span>Ingrédients de saison</span>
          </label>
        </div>

        <div className="recipe-list">
          {filteredRecipes.length === 0 && <p className="muted">Aucune recette pour ces filtres.</p>}
          {filteredRecipes.map((recipe) => (
            <button
              key={recipe.id}
              className={recipe.id === selectedRecipe?.id ? "recipe-row recipe-row--active" : "recipe-row"}
              onClick={() => onSelectRecipe(recipe.id)}
            >
              <strong>{recipe.name}</strong>
              <span>{recipe.ingredients.length} ingrédient(s)</span>
            </button>
          ))}
        </div>
      </aside>

      <RecipeDetail
        recipe={selectedRecipe}
        printRef={printRef}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onExport={onExport}
      />
    </section>
  );
}
