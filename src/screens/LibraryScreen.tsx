import type { RefObject } from "react";
import { ArrowLeft, Clock, Filter, Link, Plus, Search, Users } from "lucide-react";
import { RECIPE_ORIGINS } from "../origins";
import { RecipeDetail } from "../components/RecipeDetail";
import { SEASONAL_THRESHOLDS, SEASONAL_THRESHOLD_LABELS } from "../constants";
import type { Recipe, SeasonalThreshold } from "../types";
import { proxiedImageUrl } from "../utils/images";

export type LibraryFilters = {
  query: string;
  tagFilter: string;
  originFilter: string;
  seasonalThreshold: SeasonalThreshold;
  allTags: string[];
};

export type LibraryFilterHandlers = {
  onQueryChange: (query: string) => void;
  onTagFilterChange: (tag: string) => void;
  onOriginFilterChange: (origin: string) => void;
  onSeasonalThresholdChange: (threshold: SeasonalThreshold) => void;
};

export type LibraryRecipeActions = {
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onExport: (format: "pdf" | "png") => void;
  onSelectRecipe: (id: string) => void;
  onShowList: () => void;
  onNewRecipe: () => void;
};

type Props = {
  filters: LibraryFilters;
  filterHandlers: LibraryFilterHandlers;
  actions: LibraryRecipeActions;
  filteredRecipes: Recipe[];
  selectedRecipe?: Recipe;
  seasonalMatchCounts: Map<string, number>;
  seasonalRecipeIds: Set<string>;
  seasonMonthName: string;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  onImport: () => void;
  printRef: RefObject<HTMLDivElement>;
};

export function LibraryScreen({
  filters,
  filterHandlers,
  actions,
  filteredRecipes,
  selectedRecipe,
  seasonalMatchCounts,
  seasonalRecipeIds,
  seasonMonthName,
  importUrl,
  onImportUrlChange,
  onImport,
  printRef,
}: Props) {
  return (
    <section className="library-view">
      <LibrarySidebar
        filters={filters}
        handlers={filterHandlers}
        filteredCount={filteredRecipes.length}
        seasonalRecipeCount={seasonalRecipeIds.size}
        seasonMonthName={seasonMonthName}
        importUrl={importUrl}
        onImportUrlChange={onImportUrlChange}
        onImport={onImport}
        onNewRecipe={actions.onNewRecipe}
      />

      {selectedRecipe ? (
        <div className="detail-pane">
          <button className="button button--ghost" onClick={actions.onShowList}>
            <ArrowLeft size={18} /> Toutes les recettes
          </button>
          <RecipeDetail
            recipe={selectedRecipe}
            printRef={printRef}
            onEdit={actions.onEdit}
            onDelete={actions.onDelete}
            onDuplicate={actions.onDuplicate}
            onExport={actions.onExport}
          />
        </div>
      ) : (
        <RecipeGrid
          recipes={filteredRecipes}
          seasonalMatchCounts={seasonalMatchCounts}
          seasonalRecipeIds={seasonalRecipeIds}
          onSelectRecipe={actions.onSelectRecipe}
        />
      )}
    </section>
  );
}

function LibrarySidebar({
  filters,
  handlers,
  filteredCount,
  seasonalRecipeCount,
  seasonMonthName,
  importUrl,
  onImportUrlChange,
  onImport,
  onNewRecipe,
}: {
  filters: LibraryFilters;
  handlers: LibraryFilterHandlers;
  filteredCount: number;
  seasonalRecipeCount: number;
  seasonMonthName: string;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  onImport: () => void;
  onNewRecipe: () => void;
}) {
  return (
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
          <input
            value={filters.query}
            onChange={(event) => handlers.onQueryChange(event.target.value)}
            placeholder="Nom, ingrédient, tag"
          />
        </label>
        <label>
          <span className="label-with-icon">
            <Filter size={16} /> Tag
          </span>
          <select value={filters.tagFilter} onChange={(event) => handlers.onTagFilterChange(event.target.value)}>
            <option value="">Tous les tags</option>
            {filters.allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pays / région
          <select value={filters.originFilter} onChange={(event) => handlers.onOriginFilterChange(event.target.value)}>
            <option value="">Toutes les origines</option>
            {RECIPE_ORIGINS.map((origin) => (
              <option key={origin} value={origin}>
                {origin}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ingrédients de saison
          <select
            value={filters.seasonalThreshold}
            onChange={(event) =>
              handlers.onSeasonalThresholdChange(Number(event.target.value) as SeasonalThreshold)
            }
          >
            {SEASONAL_THRESHOLDS.map((threshold) => (
              <option key={threshold} value={threshold}>
                {SEASONAL_THRESHOLD_LABELS[threshold]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="muted">
        {filteredCount} recette(s)
        {filters.seasonalThreshold > 0
          ? ` avec au moins ${filters.seasonalThreshold} ingrédient(s) de saison en ${seasonMonthName}`
          : ""}
      </p>
      {filters.seasonalThreshold === 0 && (
        <p className="muted">
          {seasonalRecipeCount} recette(s) contiennent au moins un ingrédient de saison en {seasonMonthName}.
        </p>
      )}
    </aside>
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
          {recipe.origin && <span className="muted">{recipe.origin}</span>}
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
