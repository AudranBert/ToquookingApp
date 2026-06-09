import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChefHat, Clock, Filter, Flag, Flame, Hourglass, Search, Snowflake, Soup, Sprout, Tag, Timer, Vegan, X } from "lucide-react";
import { POPULAR_RECIPE_ORIGINS, RECIPE_ORIGIN_GROUPS, RECIPE_ORIGINS } from "../origins";
import { RecipeDetail } from "../components/RecipeDetail";
import { SectionToggleHeader } from "../components/SectionToggleHeader";
import { SEASONAL_THRESHOLDS, SEASONAL_THRESHOLD_LABELS } from "../constants";
import type { Recipe, RegimeFilter, SeasonalThreshold } from "../types";
import { primaryRecipeImageUrl, proxiedImageUrl } from "../utils/images";
import { normalizeText } from "../utils/text";
import { getTagStyle } from "../utils/tagStyle";
import type { TagCategory } from "../hooks/useTags";
import { t } from "../i18n";

const REGIME_FILTER_OPTIONS: { value: RegimeFilter; label: string }[] = [
  { value: "", label: "library.filters.regime.all" },
  { value: "omnivore", label: "omnivore" },
  { value: "végétarien", label: "végétarien" },
  { value: "végétalien", label: "végétalien" },
  { value: "pescétarien", label: "pescétarien" },
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
  tagColorByName: Map<string, string>;
  tagCategories: TagCategory[];
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
  tagColorByName: Map<string, string>;
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
  tagColorByName,
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
            <ArrowLeft size={18} /> {t("recipe.actions.backToList")}
          </button>
          <RecipeDetail
            recipe={selectedRecipe}
            printRef={printRef}
            tagColorByName={tagColorByName}
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
          tagColorByName={tagColorByName}
        />
      )}
    </section>
  );
}

function LibrarySidebar({ filters, handlers, filteredCount, seasonalRecipeCount, seasonMonthName }: { filters: LibraryFilters; handlers: LibraryFilterHandlers; filteredCount: number; seasonalRecipeCount: number; seasonMonthName: string; }) {
  const [advancedOpen, setAdvancedOpen] = useState(() => typeof window === "undefined" ? true : window.matchMedia("(min-width: 861px)").matches);
  const [cookingOpen, setCookingOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [originsOpen, setOriginsOpen] = useState(false);

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
          <span className="label-with-icon"><Search size={16} /> {t("library.filters.search")}</span>
          <input value={filters.query} onChange={(event) => handlers.onQueryChange(event.target.value)} placeholder={t("library.filters.searchPlaceholder")} />
        </label>
        <p className="muted recipe-count">
          {t("library.filters.count", { count: filteredCount })}
          {filters.seasonalThreshold > 0 ? ` ${t("library.filters.seasonalCount", { threshold: filters.seasonalThreshold, month: seasonMonthName })}` : ""}
        </p>
        <details className="advanced-filters" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary><span className="label-with-icon"><Filter size={16} /> {t("library.filters.title")}</span></summary>
          <div className="advanced-filters__body">
            <div className="tag-filter">
              <SectionToggleHeader className="origin-filter__header" open={cookingOpen} onToggle={() => setCookingOpen((current) => !current)} title={<span className="label-with-icon"><ChefHat size={16} /> {t("library.filters.prep")}</span>} />
              {cookingOpen && (
                <div className="stack filter-group-content">
                  <label className="checkbox-row"><input type="checkbox" checked={filters.noHeatingOnly} onChange={(event) => handlers.onNoHeatingOnlyChange(event.target.checked)} /><span className="label-with-icon"><Snowflake size={16} /> {t("library.filters.noHeating")}</span></label>
                  <label>
                    <span className="label-with-icon"><Timer size={16} /> {t("library.filters.maxTotal")}</span>
                    <input type="number" min="1" inputMode="numeric" value={filters.maxTotalTime ?? ""} onChange={(event) => { const minutes = Number(event.target.value); handlers.onMaxTotalTimeChange(minutes > 0 ? minutes : undefined); }} placeholder={t("library.filters.minutes")} />
                  </label>
                  <div>
                    <div className="label-with-icon"><ChefHat size={16} /> {t("library.filters.tools")}</div>
                    <div className="origin-filter__options">
                      {toolTags(filters.tagCategories).length > 0 ? (
                        toolTags(filters.tagCategories).map((tool) => {
                          const selected = filters.tagFilters.includes(tool.name);
                          return <button className={`origin-filter__option${selected ? " origin-filter__option--active" : ""}`} key={tool.id} type="button" onClick={() => handlers.onTagFiltersChange(selected ? filters.tagFilters.filter((value) => value !== tool.name) : [...filters.tagFilters, tool.name])} aria-pressed={selected}>{toolLabel(tool.name)}</button>;
                        })
                      ) : (
                        <p className="empty-inline">{t("library.filters.tools.empty")}</p>
                      )}
                    </div>
                    {filters.tagFilters.some((tag) => isToolTag(tag, filters.tagCategories)) && (
                      <button className="origin-filter__clear" type="button" onClick={() => handlers.onTagFiltersChange(filters.tagFilters.filter((tag) => !isToolTag(tag, filters.tagCategories)))}>
                        <X size={14} /> {t("library.filters.clear")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="tag-filter">
              <SectionToggleHeader className="origin-filter__header" open={ingredientsOpen} onToggle={() => setIngredientsOpen((current) => !current)} title={<span className="label-with-icon"><Soup size={16} /> {t("library.filters.ingredients")}</span>} />
              {ingredientsOpen && (
                <div className="stack filter-group-content">
                  <label><span className="label-with-icon"><Vegan size={16} /> {t("library.filters.regime")}</span><select value={filters.regimeFilter} onChange={(event) => handlers.onRegimeFilterChange(event.target.value as RegimeFilter)}>{REGIME_FILTER_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label.startsWith("library.") ? t(option.label as never) : option.label}</option>)}</select></label>
                  <label><span className="label-with-icon"><Sprout size={16} /> {t("library.filters.seasonal")}</span><select value={filters.seasonalThreshold} onChange={(event) => handlers.onSeasonalThresholdChange(Number(event.target.value) as SeasonalThreshold)}>{SEASONAL_THRESHOLDS.map((threshold) => <option key={threshold} value={threshold}>{SEASONAL_THRESHOLD_LABELS[threshold]}</option>)}</select></label>
                  {filters.seasonalThreshold === 0 && <p className="muted">{t("library.filters.seasonalInfo", { count: seasonalRecipeCount, month: seasonMonthName })}</p>}
                </div>
              )}
            </div>
            <OriginFilterPicker value={filters.originFilter} onChange={handlers.onOriginFilterChange} open={originsOpen} onToggle={() => setOriginsOpen((current) => !current)} />
            <div className="tag-filter">
              <SectionToggleHeader className="origin-filter__header" open={tagsOpen} onToggle={() => setTagsOpen((current) => !current)} title={<span className="label-with-icon"><Tag size={16} /> {t("manage.tags")}</span>} rightSlot={filters.tagFilters.length > 0 ? <button className="origin-filter__clear" type="button" onClick={() => handlers.onTagFiltersChange([])}><X size={14} /> {t("library.filters.clear")}</button> : undefined} />
              {tagsOpen && (
                <div className="tag-filter__groups filter-group-content">
                  {filters.tagCategories.filter((category) => normalizeText(category.name) !== normalizeText("Régime alimentaire")).length > 0 ? (
                    filters.tagCategories.filter((category) => normalizeText(category.name) !== normalizeText("Régime alimentaire")).map((category) => (
                      <section className="origin-filter__group" key={category.name}>
                        <h3>{category.name}</h3>
                        <div className="tag-filter__options">
                          {category.tags.map((tag) => {
                            const selected = filters.tagFilters.includes(tag.name);
                            return <button className={`origin-filter__option${selected ? " origin-filter__option--active" : ""}`} key={tag.id} type="button" style={selected ? undefined : getTagStyle(tag.name, filters.tagColorByName, tag.color)} onClick={() => handlers.onTagFiltersChange(selected ? filters.tagFilters.filter((selectedTag) => selectedTag !== tag.name) : [...filters.tagFilters, tag.name])} aria-pressed={selected}>{tag.name}</button>;
                          })}
                        </div>
                      </section>
                    ))
                  ) : <p className="empty-inline">{t("manage.empty.tags")}</p>}
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}

function toolTags(categories: TagCategory[]) {
  return categories.find((category) => normalizeText(category.name) === normalizeText(t("manage.category.tools")))?.tags ?? [];
}

function isToolTag(tagName: string, categories: TagCategory[]) {
  const tools = toolTags(categories);
  return tools.some((tag) => tag.name === tagName);
}

function toolLabel(name: string) {
  return t(`recipe.tools.${name}` as never);
}

function OriginFilterPicker({ value, onChange, open, onToggle }: { value: string; onChange: (origin: string) => void; open: boolean; onToggle: () => void; }) {
  const [originQuery, setOriginQuery] = useState("");
  const normalizedQuery = normalizeText(originQuery);
  const filteredGroups = useMemo(() => RECIPE_ORIGIN_GROUPS.map((group) => ({ ...group, origins: group.origins.filter((origin) => normalizeText(origin).includes(normalizedQuery)) })).filter((group) => group.origins.length > 0), [normalizedQuery]);
  const ungroupedMatches = useMemo(() => {
    const groupedOrigins = new Set(RECIPE_ORIGIN_GROUPS.flatMap((group) => group.origins));
    return RECIPE_ORIGINS.filter((origin) => !groupedOrigins.has(origin) && normalizeText(origin).includes(normalizedQuery));
  }, [normalizedQuery]);
  const hasMatches = filteredGroups.length > 0 || ungroupedMatches.length > 0;
  function selectOrigin(origin: string) { onChange(origin); setOriginQuery(""); }

  return (
    <div className="origin-filter">
      <SectionToggleHeader className="origin-filter__header" open={open} onToggle={onToggle} title={<span className="label-with-icon"><Flag size={16} /> {t("library.filters.origin")}</span>} rightSlot={value ? <button className="origin-filter__clear" type="button" onClick={() => onChange("")}><X size={14} /> {t("library.filters.clear")}</button> : undefined} />
      {open && (
        <div className="filter-group-content">
          <label className="origin-filter__search"><span className="label-with-icon"><Search size={16} /> {t("library.filters.originSearch")}</span><input value={originQuery} onChange={(event) => setOriginQuery(event.target.value)} placeholder={t("library.filters.originPlaceholder")} /></label>
          {value && <div className="origin-filter__selected" aria-label={t("library.filters.originSelected")}><button className="chip origin-filter__chip" type="button" onClick={() => onChange("")}>{value}<X size={14} /></button></div>}
          {!originQuery && <OriginButtonGroup title={t("library.filters.popular")} origins={POPULAR_RECIPE_ORIGINS} value={value} onSelect={selectOrigin} />}
          <div className="origin-filter__groups">
            {hasMatches ? <>{filteredGroups.map((group) => <OriginButtonGroup key={group.label} title={group.label} origins={group.origins} value={value} onSelect={selectOrigin} />)}{ungroupedMatches.length > 0 && <OriginButtonGroup title={t("library.filters.others")} origins={ungroupedMatches} value={value} onSelect={selectOrigin} />}</> : <p className="empty-inline">{t("library.filters.noOrigin")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function OriginButtonGroup({ title, origins, value, onSelect }: { title: string; origins: string[]; value: string; onSelect: (origin: string) => void; }) {
  return <section className="origin-filter__group"><h3>{title}</h3><div className="origin-filter__options">{origins.map((origin) => <button className={`origin-filter__option${origin === value ? " origin-filter__option--active" : ""}`} key={origin} type="button" onClick={() => onSelect(origin)} aria-pressed={origin === value}>{origin}</button>)}</div></section>;
}

function RecipeGrid({ recipes, seasonalMatchCounts, seasonalRecipeIds, onSelectRecipe, tagColorByName }: { recipes: Recipe[]; seasonalMatchCounts: Map<string, number>; seasonalRecipeIds: Set<string>; onSelectRecipe: (id: string) => void; tagColorByName: Map<string, string>; }) {
  if (recipes.length === 0) return <section className="empty-state panel"><h2>{t("library.empty.title")}</h2><p>{t("library.empty.body")}</p></section>;
  return (
    <section className="recipe-grid" aria-label={t("recipe.actions.backToList")}>
      {recipes.map((recipe) => (
        <button className="recipe-card-button" key={recipe.id} onClick={() => onSelectRecipe(recipe.id)}>
          {primaryRecipeImageUrl(recipe) ? <img src={proxiedImageUrl(primaryRecipeImageUrl(recipe), recipe.sourceUrl)} alt="" /> : <div className="recipe-card-placeholder" />}
          <span className="recipe-card-title">{recipe.name}</span>
          {recipe.origin && <span className="muted">{recipe.origin}</span>}
          <span className="recipe-card-meta">
            <span aria-label={`${t("recipe.detail.prep")} ${recipe.prepTime ? `${recipe.prepTime} min` : t("library.time.unknown")}`} title={t("recipe.detail.prep")}><ChefHat size={15} /> {recipe.prepTime ? `${recipe.prepTime} min` : "-"}</span>
            {recipe.cookTime ? <span aria-label={`${t("recipe.detail.cook")} ${recipe.cookTime} min`} title={t("recipe.detail.cook")}><Flame size={15} /> {recipe.cookTime} min</span> : null}
            {recipe.restTime ? <span aria-label={`${t("recipe.detail.rest")} ${recipe.restTime} min`} title={t("recipe.detail.rest")}><Hourglass size={15} /> {recipe.restTime} min</span> : null}
            <span aria-label={`${t("recipe.detail.total")} ${recipe.totalTime ? `${recipe.totalTime} min` : t("library.time.unknown")}`} title={t("recipe.detail.total")}><Clock size={15} /> {recipe.totalTime ? `${recipe.totalTime} min` : "-"}</span>
          </span>
          {(recipe.tags.length > 0 || seasonalRecipeIds.has(recipe.id)) && <span className="chip-list">{seasonalRecipeIds.has(recipe.id) && <span className="chip chip--seasonal">{seasonalMatchCounts.get(recipe.id)} {t("recipe.detail.seasonal")}</span>}{recipe.tags.slice(0, 4).map((tag) => <span className="chip" key={tag} style={getTagStyle(tag, tagColorByName)}>{tag}</span>)}</span>}
        </button>
      ))}
    </section>
  );
}
