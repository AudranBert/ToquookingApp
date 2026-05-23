import { useMemo, useState } from "react";
import type { Recipe, RegimeFilter, SeasonalThreshold } from "../types";
import { countSeasonalIngredientMatches, currentSeasonalIngredients } from "../seasonal";
import { originMatchesFilter } from "../origins";
import { recipeMatchesQuery } from "../utils/recipes";

export function useRecipeFilters(recipes: Recipe[], globalTags: string[]) {
  const [query, setQuery] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState("");
  const [regimeFilter, setRegimeFilter] = useState<RegimeFilter>("");
  const [noHeatingOnly, setNoHeatingOnly] = useState(false);
  const [maxTotalTime, setMaxTotalTime] = useState<number | undefined>();
  const [seasonalThreshold, setSeasonalThreshold] = useState<SeasonalThreshold>(0);

  const seasonalIngredients = currentSeasonalIngredients();

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
        const tagMatches = tagFilters.every((tag) => recipe.tags.includes(tag));
        const originMatches = originMatchesFilter(recipe.origin, originFilter);
        const regimeMatches = !regimeFilter || recipe.tags.includes(regimeFilter);
        const heatingMatches = !noHeatingOnly || !recipe.cookTime;
        const totalTimeMatches = !maxTotalTime || Boolean(recipe.totalTime && recipe.totalTime <= maxTotalTime);
        const seasonMatches =
          seasonalThreshold === 0 || (seasonalMatchCounts.get(recipe.id) ?? 0) >= seasonalThreshold;
        return (
          recipeMatchesQuery(recipe, query) &&
          tagMatches &&
          originMatches &&
          regimeMatches &&
          heatingMatches &&
          totalTimeMatches &&
          seasonMatches
        );
      }),
    [
      recipes,
      query,
      tagFilters,
      originFilter,
      regimeFilter,
      noHeatingOnly,
      maxTotalTime,
      seasonalThreshold,
      seasonalMatchCounts,
    ],
  );

  return {
    query,
    setQuery,
    tagFilters,
    setTagFilters,
    originFilter,
    setOriginFilter,
    regimeFilter,
    setRegimeFilter,
    noHeatingOnly,
    setNoHeatingOnly,
    maxTotalTime,
    setMaxTotalTime,
    seasonalThreshold,
    setSeasonalThreshold,
    allTags: globalTags,
    seasonalMatchCounts,
    seasonalRecipeIds,
    filteredRecipes,
  };
}

export type RecipeFiltersApi = ReturnType<typeof useRecipeFilters>;
