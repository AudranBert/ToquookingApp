import type { RefObject } from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, Filter, Link, Plus, Search, Users, X } from "lucide-react";
import { POPULAR_RECIPE_ORIGINS, RECIPE_ORIGIN_GROUPS, RECIPE_ORIGINS } from "../origins";
import { RecipeDetail } from "../components/RecipeDetail";
import { SEASONAL_THRESHOLDS, SEASONAL_THRESHOLD_LABELS } from "../constants";
import type { Recipe, SeasonalThreshold } from "../types";
import { proxiedImageUrl } from "../utils/images";
import { normalizeText } from "../utils/text";

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
        <OriginFilterPicker value={filters.originFilter} onChange={handlers.onOriginFilterChange} />
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

function OriginFilterPicker({ value, onChange }: { value: string; onChange: (origin: string) => void }) {
  const [originQuery, setOriginQuery] = useState("");
  const normalizedQuery = normalizeText(originQuery);

  const filteredGroups = useMemo(
    () =>
      RECIPE_ORIGIN_GROUPS.map((group) => ({
        ...group,
        origins: group.origins.filter((origin) => normalizeText(origin).includes(normalizedQuery)),
      })).filter((group) => group.origins.length > 0),
    [normalizedQuery],
  );

  const ungroupedMatches = useMemo(() => {
    const groupedOrigins = new Set(RECIPE_ORIGIN_GROUPS.flatMap((group) => group.origins));
    return RECIPE_ORIGINS.filter(
      (origin) => !groupedOrigins.has(origin) && normalizeText(origin).includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const hasMatches = filteredGroups.length > 0 || ungroupedMatches.length > 0;

  function selectOrigin(origin: string) {
    onChange(origin);
    setOriginQuery("");
  }

  return (
    <div className="origin-filter">
      <div className="origin-filter__header">
        <span>Pays / région</span>
        {value && (
          <button className="origin-filter__clear" type="button" onClick={() => onChange("")}>
            <X size={14} /> Effacer
          </button>
        )}
      </div>

      <label className="origin-filter__search">
        <span className="label-with-icon">
          <Search size={16} /> Rechercher une origine
        </span>
        <input
          value={originQuery}
          onChange={(event) => setOriginQuery(event.target.value)}
          placeholder="France, Japon, Méditerranée..."
        />
      </label>

      {value && (
        <div className="origin-filter__selected" aria-label="Origine sélectionnée">
          <button className="chip origin-filter__chip" type="button" onClick={() => onChange("")}>
            {value}
            <X size={14} />
          </button>
        </div>
      )}

      {!originQuery && (
        <OriginButtonGroup title="Populaires" origins={POPULAR_RECIPE_ORIGINS} value={value} onSelect={selectOrigin} />
      )}

      <div className="origin-filter__groups">
        {hasMatches ? (
          <>
            {filteredGroups.map((group) => (
              <OriginButtonGroup
                key={group.label}
                title={group.label}
                origins={group.origins}
                value={value}
                onSelect={selectOrigin}
              />
            ))}
            {ungroupedMatches.length > 0 && (
              <OriginButtonGroup title="Autres" origins={ungroupedMatches} value={value} onSelect={selectOrigin} />
            )}
          </>
        ) : (
          <p className="empty-inline">Aucune origine trouvée.</p>
        )}
      </div>
    </div>
  );
}

function OriginButtonGroup({
  title,
  origins,
  value,
  onSelect,
}: {
  title: string;
  origins: string[];
  value: string;
  onSelect: (origin: string) => void;
}) {
  return (
    <section className="origin-filter__group">
      <h3>{title}</h3>
      <div className="origin-filter__options">
        {origins.map((origin) => (
          <button
            className={`origin-filter__option${origin === value ? " origin-filter__option--active" : ""}`}
            key={origin}
            type="button"
            onClick={() => onSelect(origin)}
            aria-pressed={origin === value}
          >
            {origin}
          </button>
        ))}
      </div>
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
