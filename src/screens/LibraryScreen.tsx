import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChefHat, Clock, Filter, Flame, Hourglass, Search, X } from "lucide-react";
import { POPULAR_RECIPE_ORIGINS, RECIPE_ORIGIN_GROUPS, RECIPE_ORIGINS } from "../origins";
import { RecipeDetail } from "../components/RecipeDetail";
import { SectionToggleHeader } from "../components/SectionToggleHeader";
import { SEASONAL_THRESHOLDS, SEASONAL_THRESHOLD_LABELS } from "../constants";
import type { Recipe, RegimeFilter, SeasonalThreshold } from "../types";
import { proxiedImageUrl } from "../utils/images";
import { normalizeText } from "../utils/text";

const REGIME_FILTER_OPTIONS: { value: RegimeFilter; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "omnivore", label: "omnivore" },
  { value: "v\u00e9g\u00e9tarien", label: "v\u00e9g\u00e9tarien" },
  { value: "v\u00e9g\u00e9talien", label: "v\u00e9g\u00e9talien" },
  { value: "pesc\u00e9tarien", label: "pesc\u00e9tarien" },
];

export type LibraryFilters = {
  query: string;
  tagFilters: string[];
  originFilter: string;
  regimeFilter: RegimeFilter;
  noHeatingOnly: boolean;
  maxTotalTime?: number;
  seasonalThreshold: SeasonalThreshold;
  allTags: string[];
};

export type LibraryFilterHandlers = {
  onQueryChange: (query: string) => void;
  onTagFiltersChange: (tags: string[]) => void;
  onOriginFilterChange: (origin: string) => void;
  onRegimeFilterChange: (regime: RegimeFilter) => void;
  onNoHeatingOnlyChange: (enabled: boolean) => void;
  onMaxTotalTimeChange: (minutes?: number) => void;
  onSeasonalThresholdChange: (threshold: SeasonalThreshold) => void;
};

export type LibraryRecipeActions = {
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onExportPdf: () => void;
  onShareImage: () => void;
  onShareText: () => void;
  onExportRecipeFile: () => void;
  onSelectRecipe: (id: string) => void;
  onShowList: () => void;
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
      />

      {selectedRecipe ? (
        <div className="detail-pane">
          <button className="button button--ghost button--icon-mobile" onClick={actions.onShowList}>
            <ArrowLeft size={18} /> Toutes les recettes
          </button>
          <RecipeDetail
            recipe={selectedRecipe}
            printRef={printRef}
            onEdit={actions.onEdit}
            onDelete={actions.onDelete}
            onDuplicate={actions.onDuplicate}
            onExportPdf={actions.onExportPdf}
            onShareImage={actions.onShareImage}
            onShareText={actions.onShareText}
            onExportRecipeFile={actions.onExportRecipeFile}
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
}: {
  filters: LibraryFilters;
  handlers: LibraryFilterHandlers;
  filteredCount: number;
  seasonalRecipeCount: number;
  seasonMonthName: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 861px)").matches,
  );
  const [tagsOpen, setTagsOpen] = useState(true);
  const [originsOpen, setOriginsOpen] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 861px)");
    const handleChange = () => setAdvancedOpen(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <aside className="panel sidebar">
      <div className="filters">
        <label>
          <span className="label-with-icon">
            <Search size={16} /> Rechercher
          </span>
          <input value={filters.query} onChange={(event) => handlers.onQueryChange(event.target.value)} placeholder="Nom, ingrédient, tag" />
        </label>
        <p className="muted recipe-count">
          {filteredCount} recette(s)
          {filters.seasonalThreshold > 0
            ? ` avec au moins ${filters.seasonalThreshold} ingrédient(s) de saison en ${seasonMonthName}`
            : ""}
        </p>
        <details className="advanced-filters" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary>
            <span className="label-with-icon">
              <Filter size={16} /> Filtres
            </span>
          </summary>
          <div className="advanced-filters__body">
            <div className="tag-filter">
              <SectionToggleHeader
                className="origin-filter__header"
                open={tagsOpen}
                onToggle={() => setTagsOpen((current) => !current)}
                title={
                  <span className="label-with-icon">
                    <Filter size={16} /> Tags
                  </span>
                }
                rightSlot={
                  filters.tagFilters.length > 0 ? (
                    <button className="origin-filter__clear" type="button" onClick={() => handlers.onTagFiltersChange([])}>
                      <X size={14} /> Effacer
                    </button>
                  ) : undefined
                }
              />
              {tagsOpen && (
                <div className="tag-filter__options">
                  {filters.allTags.length > 0 ? (
                    filters.allTags.map((tag) => {
                      const selected = filters.tagFilters.includes(tag);
                      return (
                        <button
                          className={`origin-filter__option${selected ? " origin-filter__option--active" : ""}`}
                          key={tag}
                          type="button"
                          onClick={() =>
                            handlers.onTagFiltersChange(
                              selected ? filters.tagFilters.filter((selectedTag) => selectedTag !== tag) : [...filters.tagFilters, tag],
                            )
                          }
                          aria-pressed={selected}
                        >
                          {tag}
                        </button>
                      );
                    })
                  ) : (
                    <p className="empty-inline">Aucun tag.</p>
                  )}
                </div>
              )}
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={filters.noHeatingOnly} onChange={(event) => handlers.onNoHeatingOnlyChange(event.target.checked)} />
              <span>No heating</span>
            </label>
            <label>
              Régime
              <select value={filters.regimeFilter} onChange={(event) => handlers.onRegimeFilterChange(event.target.value as RegimeFilter)}>
                {REGIME_FILTER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Total ≤ X min
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={filters.maxTotalTime ?? ""}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  handlers.onMaxTotalTimeChange(minutes > 0 ? minutes : undefined);
                }}
                placeholder="Minutes"
              />
            </label>
            <OriginFilterPicker
              value={filters.originFilter}
              onChange={handlers.onOriginFilterChange}
              open={originsOpen}
              onToggle={() => setOriginsOpen((current) => !current)}
            />
            <label>
              Ingrédients de saison
              <select
                value={filters.seasonalThreshold}
                onChange={(event) => handlers.onSeasonalThresholdChange(Number(event.target.value) as SeasonalThreshold)}
              >
                {SEASONAL_THRESHOLDS.map((threshold) => (
                  <option key={threshold} value={threshold}>
                    {SEASONAL_THRESHOLD_LABELS[threshold]}
                  </option>
                ))}
              </select>
            </label>
            {filters.seasonalThreshold === 0 && (
              <p className="muted">{seasonalRecipeCount} recette(s) contiennent au moins un ingrédient de saison en {seasonMonthName}.</p>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}

function OriginFilterPicker({
  value,
  onChange,
  open,
  onToggle,
}: {
  value: string;
  onChange: (origin: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
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
    return RECIPE_ORIGINS.filter((origin) => !groupedOrigins.has(origin) && normalizeText(origin).includes(normalizedQuery));
  }, [normalizedQuery]);

  const hasMatches = filteredGroups.length > 0 || ungroupedMatches.length > 0;

  function selectOrigin(origin: string) {
    onChange(origin);
    setOriginQuery("");
  }

  return (
    <div className="origin-filter">
      <SectionToggleHeader
        className="origin-filter__header"
        open={open}
        onToggle={onToggle}
        title="Pays / région"
        rightSlot={
          value ? (
            <button className="origin-filter__clear" type="button" onClick={() => onChange("")}>
              <X size={14} /> Effacer
            </button>
          ) : undefined
        }
      />

      {open && (
        <>
          <label className="origin-filter__search">
            <span className="label-with-icon">
              <Search size={16} /> Rechercher une origine
            </span>
            <input value={originQuery} onChange={(event) => setOriginQuery(event.target.value)} placeholder="France, Japon, Méditerranée..." />
          </label>

          {value && (
            <div className="origin-filter__selected" aria-label="Origine sélectionnée">
              <button className="chip origin-filter__chip" type="button" onClick={() => onChange("")}>
                {value}
                <X size={14} />
              </button>
            </div>
          )}

          {!originQuery && <OriginButtonGroup title="Populaires" origins={POPULAR_RECIPE_ORIGINS} value={value} onSelect={selectOrigin} />}

          <div className="origin-filter__groups">
            {hasMatches ? (
              <>
                {filteredGroups.map((group) => (
                  <OriginButtonGroup key={group.label} title={group.label} origins={group.origins} value={value} onSelect={selectOrigin} />
                ))}
                {ungroupedMatches.length > 0 && <OriginButtonGroup title="Autres" origins={ungroupedMatches} value={value} onSelect={selectOrigin} />}
              </>
            ) : (
              <p className="empty-inline">Aucune origine trouvée.</p>
            )}
          </div>
        </>
      )}
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
          {recipe.imageUrl ? <img src={proxiedImageUrl(recipe.imageUrl, recipe.sourceUrl)} alt="" /> : <div className="recipe-card-placeholder" />}
          <span className="recipe-card-title">{recipe.name}</span>
          {recipe.origin && <span className="muted">{recipe.origin}</span>}
          <span className="recipe-card-meta">
            <span aria-label={`Préparation ${recipe.prepTime ? `${recipe.prepTime} min` : "non renseignée"}`} title="Préparation">
              <ChefHat size={15} /> {recipe.prepTime ? `${recipe.prepTime} min` : "-"}
            </span>
            {recipe.cookTime ? (
              <span aria-label={`Cuisson ${recipe.cookTime} min`} title="Cuisson">
                <Flame size={15} /> {recipe.cookTime} min
              </span>
            ) : null}
            {recipe.restTime ? (
              <span aria-label={`Repos ${recipe.restTime} min`} title="Repos">
                <Hourglass size={15} /> {recipe.restTime} min
              </span>
            ) : null}
            <span aria-label={`Total ${recipe.totalTime ? `${recipe.totalTime} min` : "non renseigné"}`} title="Total">
              <Clock size={15} /> {recipe.totalTime ? `${recipe.totalTime} min` : "-"}
            </span>
          </span>
          {(recipe.tags.length > 0 || seasonalRecipeIds.has(recipe.id)) && (
            <span className="chip-list">
              {seasonalRecipeIds.has(recipe.id) && <span className="chip chip--seasonal">{seasonalMatchCounts.get(recipe.id)} de saison</span>}
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
