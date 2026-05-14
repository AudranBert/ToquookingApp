import type { RefObject } from "react";
import { ArrowLeft, Clock, Filter, Link, Plus, Search, Users } from "lucide-react";
import { RecipeDetail } from "../components/RecipeDetail";
import type { Recipe } from "../types";
import { proxiedImageUrl } from "../utils/images";

type SeasonalThreshold = 0 | 1 | 3;

type Props = {
  allTags: string[];
  filteredRecipes: Recipe[];
  importUrl: string;
  query: string;
  selectedRecipe?: Recipe;
  seasonalMatchCounts: Map<string, number>;
  seasonalRecipeIds: Set<string>;
  seasonalThreshold: SeasonalThreshold;
  seasonMonthName: string;
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
  onSeasonalThresholdChange: (threshold: SeasonalThreshold) => void;
  onSelectRecipe: (id: string) => void;
  onShowList: () => void;
  onTagFilterChange: (tag: string) => void;
};

export function LibraryScreen({
  allTags,
  filteredRecipes,
  importUrl,
  query,
  selectedRecipe,
  seasonalMatchCounts,
  seasonalRecipeIds,
  seasonalThreshold,
  seasonMonthName,
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
  onSeasonalThresholdChange,
  onSelectRecipe,
  onShowList,
  onTagFilterChange,
}: Props) {
  return (
    <section className="library-view">
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
          <label>
            Ingrédients de saison
            <select
              value={seasonalThreshold}
              onChange={(event) => onSeasonalThresholdChange(Number(event.target.value) as SeasonalThreshold)}
            >
              <option value={0}>Toutes les recettes</option>
              <option value={1}>Au moins 1</option>
              <option value={3}>Au moins 3</option>
            </select>
          </label>
        </div>

        <p className="muted">
          {filteredRecipes.length} recette(s)
          {seasonalThreshold > 0 ? ` avec au moins ${seasonalThreshold} ingrédient(s) de saison en ${seasonMonthName}` : ""}
        </p>
        {seasonalThreshold === 0 && (
          <p className="muted">
            {seasonalRecipeIds.size} recette(s) contiennent au moins un ingrédient de saison en {seasonMonthName}.
          </p>
        )}
      </aside>

      {selectedRecipe ? (
        <div className="detail-pane">
          <button className="button button--ghost" onClick={onShowList}>
            <ArrowLeft size={18} /> Toutes les recettes
          </button>
          <RecipeDetail
            recipe={selectedRecipe}
            printRef={printRef}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onExport={onExport}
          />
        </div>
      ) : (
        <RecipeGrid recipes={filteredRecipes} seasonalMatchCounts={seasonalMatchCounts} seasonalRecipeIds={seasonalRecipeIds} onSelectRecipe={onSelectRecipe} />
      )}
    </section>
  );
}

function RecipeGrid({
  recipes,
  seasonalMatchCounts,
  seasonalRecipeIds,
  onSelectRecipe,
}: {
  recipes: Recipe[];
  seasonalMatchCounts: Map<string, number>;
  seasonalRecipeIds: Set<string>;
  onSelectRecipe: (id: string) => void;
}) {
  if (recipes.length === 0) {
    return (
      <section className="empty-state panel">
        <h2>Aucune recette</h2>
        <p>Ajoute une recette ou modifie les filtres.</p>
      </section>
    );
  }

  return (
    <section className="recipe-grid" aria-label="Toutes les recettes">
      {recipes.map((recipe) => (
        <button className="recipe-card-button" key={recipe.id} onClick={() => onSelectRecipe(recipe.id)}>
          {recipe.imageUrl ? <img src={proxiedImageUrl(recipe.imageUrl)} alt="" /> : <div className="recipe-card-placeholder" />}
          <span className="recipe-card-title">{recipe.name}</span>
          <span className="recipe-card-meta">
            <span>
              <Users size={15} /> {recipe.servings ?? "-"}
            </span>
            <span>
              <Clock size={15} /> {recipe.totalTime ? `${recipe.totalTime} min` : "-"}
            </span>
          </span>
          {(recipe.tags.length > 0 || seasonalRecipeIds.has(recipe.id)) && (
            <span className="chip-list">
              {seasonalRecipeIds.has(recipe.id) && (
                <span className="chip chip--seasonal">{seasonalMatchCounts.get(recipe.id)} de saison</span>
              )}
              {recipe.tags.slice(0, 4).map((tag) => (
                <span className="chip" key={tag}>
                  {tag}
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
    </section>
  );
}
