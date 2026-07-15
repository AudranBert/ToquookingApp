import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Recipe, RegimeFilter, SeasonalThreshold } from "../types";
import { countSeasonalIngredientMatches, currentSeasonalIngredients } from "../seasonal";
import { originMatchesFilter } from "../origins";
import { recipeMatchesQuery } from "../utils/recipes";
import { normalizeText } from "../utils/text";

const DRAFT_TAG_KEYS = new Set(["brouillon", "draft"]);
const OVEN_TAG_KEYS = new Set(["oven", "four"]);

export type LibraryFilterPreset = {
  id: "quick-dinner" | "no-oven" | "seasonal";
  labelKey: "library.presets.quickDinner" | "library.presets.noOven" | "library.presets.seasonal";
  filters: {
    query?: string;
    tagFilters?: string[];
    excludedTagFilters?: string[];
    originFilter?: string;
    regimeFilter?: RegimeFilter;
    noHeatingOnly?: boolean;
    maxTotalTime?: number;
    seasonalThreshold?: SeasonalThreshold;
  };
};

export const LIBRARY_FILTER_PRESETS: LibraryFilterPreset[] = [
  {
    id: "quick-dinner",
    labelKey: "library.presets.quickDinner",
    filters: {
      query: "",
      tagFilters: [],
      excludedTagFilters: [],
      originFilter: "",
      regimeFilter: "",
      noHeatingOnly: false,
      maxTotalTime: 30,
      seasonalThreshold: 0,
    },
  },
  {
    id: "no-oven",
    labelKey: "library.presets.noOven",
    filters: {
      query: "",
      tagFilters: [],
      excludedTagFilters: ["oven"],
      originFilter: "",
      regimeFilter: "",
      noHeatingOnly: false,
      maxTotalTime: undefined,
      seasonalThreshold: 0,
    },
  },
  {
    id: "seasonal",
    labelKey: "library.presets.seasonal",
    filters: {
      query: "",
      tagFilters: [],
      excludedTagFilters: [],
      originFilter: "",
      regimeFilter: "",
      noHeatingOnly: false,
      maxTotalTime: undefined,
      seasonalThreshold: 1,
    },
  },
];

function isDraftTag(tag: string) {
  return DRAFT_TAG_KEYS.has(normalizeText(tag));
}

function isDraftRecipe(recipe: Recipe) {
  return recipe.tags.some(isDraftTag);
}

function tagMatchesFilter(tag: string, filter: string) {
  const tagKey = normalizeText(tag);
  const filterKey = normalizeText(filter);
  if (filterKey === "oven") return OVEN_TAG_KEYS.has(tagKey);
  return tagKey === filterKey;
}

function queryRequestsDraft(query: string) {
  return normalizeText(query).split(/\s+/).some((word) => DRAFT_TAG_KEYS.has(word));
}

function queryWithoutDraftTerms(query: string) {
  return normalizeText(query)
    .split(/\s+/)
    .filter((word) => word && !DRAFT_TAG_KEYS.has(word))
    .join(" ");
}

function resolveStateAction<T>(current: T, action: SetStateAction<T>) {
  return typeof action === "function" ? (action as (value: T) => T)(current) : action;
}

export function useRecipeFilters(recipes: Recipe[], globalTags: string[]) {
  const [query, setQuery] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [excludedTagFilters, setExcludedTagFilters] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState("");
  const [regimeFilter, setRegimeFilter] = useState<RegimeFilter>("");
  const [noHeatingOnly, setNoHeatingOnly] = useState(false);
  const [maxTotalTime, setMaxTotalTime] = useState<number | undefined>();
  const [seasonalThreshold, setSeasonalThreshold] = useState<SeasonalThreshold>(0);
  const [activePresetId, setActivePresetId] = useState<LibraryFilterPreset["id"] | "">("");

  const seasonalIngredients = currentSeasonalIngredients();
  const draftRequestedByTag = tagFilters.some(isDraftTag);
  const draftRequestedByQuery = queryRequestsDraft(query);
  const draftRequested = draftRequestedByTag || draftRequestedByQuery;
  const queryForMatching = draftRequestedByQuery ? queryWithoutDraftTerms(query) : query;

  const seasonalMatchCounts = useMemo(
    () =>
      new Map(
        recipes.map((recipe) => [
          recipe.id,
          countSeasonalIngredientMatches(
            recipe.ingredients.map((ingredient) => ingredient.name),
            seasonalIngredients,
          ),
        ]),
      ),
    [recipes, seasonalIngredients],
  );

  const seasonalRecipeIds = useMemo(
    () => new Set([...seasonalMatchCounts].filter(([, count]) => count > 0).map(([id]) => id)),
    [seasonalMatchCounts],
  );

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const draftRecipe = isDraftRecipe(recipe);
        const draftMatches = draftRequestedByQuery ? draftRecipe : !draftRecipe || draftRequested;
        const queryMatches = recipeMatchesQuery(recipe, queryForMatching);
        const tagMatches = tagFilters.every((tag) => recipe.tags.includes(tag));
        const excludedTagMatches = excludedTagFilters.every((tag) => !recipe.tags.some((recipeTag) => tagMatchesFilter(recipeTag, tag)));
        const originMatches = originMatchesFilter(recipe.origin, originFilter);
        const regimeMatches = !regimeFilter || recipe.tags.includes(regimeFilter);
        const heatingMatches = !noHeatingOnly || !recipe.cookTime;
        const totalTimeMatches = !maxTotalTime || Boolean(recipe.totalTime && recipe.totalTime <= maxTotalTime);
        const seasonMatches =
          seasonalThreshold === 0 || (seasonalMatchCounts.get(recipe.id) ?? 0) >= seasonalThreshold;
        return (
          draftMatches &&
          queryMatches &&
          tagMatches &&
          excludedTagMatches &&
          originMatches &&
          regimeMatches &&
          heatingMatches &&
          totalTimeMatches &&
          seasonMatches
        );
      }),
    [
      recipes,
      draftRequested,
      draftRequestedByQuery,
      queryForMatching,
      tagFilters,
      excludedTagFilters,
      originFilter,
      regimeFilter,
      noHeatingOnly,
      maxTotalTime,
      seasonalThreshold,
      seasonalMatchCounts,
    ],
  );

  function applyPreset(preset: LibraryFilterPreset) {
    setQuery(preset.filters.query ?? "");
    setTagFilters(preset.filters.tagFilters ?? []);
    setExcludedTagFilters(preset.filters.excludedTagFilters ?? []);
    setOriginFilter(preset.filters.originFilter ?? "");
    setRegimeFilter(preset.filters.regimeFilter ?? "");
    setNoHeatingOnly(preset.filters.noHeatingOnly ?? false);
    setMaxTotalTime(preset.filters.maxTotalTime);
    setSeasonalThreshold(preset.filters.seasonalThreshold ?? 0);
    setActivePresetId(preset.id);
  }

  function clearFilters() {
    setQuery("");
    setTagFilters([]);
    setExcludedTagFilters([]);
    setOriginFilter("");
    setRegimeFilter("");
    setNoHeatingOnly(false);
    setMaxTotalTime(undefined);
    setSeasonalThreshold(0);
    setActivePresetId("");
  }

  function updateFilter<T>(setter: Dispatch<SetStateAction<T>>) {
    return (value: SetStateAction<T>) => {
      setter((current) => resolveStateAction(current, value));
      setActivePresetId("");
    };
  }

  return {
    query,
    setQuery: updateFilter(setQuery),
    tagFilters,
    setTagFilters: updateFilter(setTagFilters),
    excludedTagFilters,
    setExcludedTagFilters: updateFilter(setExcludedTagFilters),
    originFilter,
    setOriginFilter: updateFilter(setOriginFilter),
    regimeFilter,
    setRegimeFilter: updateFilter(setRegimeFilter),
    noHeatingOnly,
    setNoHeatingOnly: updateFilter(setNoHeatingOnly),
    maxTotalTime,
    setMaxTotalTime: updateFilter(setMaxTotalTime),
    seasonalThreshold,
    setSeasonalThreshold: updateFilter(setSeasonalThreshold),
    allTags: globalTags,
    seasonalMatchCounts,
    seasonalRecipeIds,
    filteredRecipes,
    filterPresets: LIBRARY_FILTER_PRESETS,
    activePresetId,
    applyPreset,
    clearFilters,
  };
}

export type RecipeFiltersApi = ReturnType<typeof useRecipeFilters>;
