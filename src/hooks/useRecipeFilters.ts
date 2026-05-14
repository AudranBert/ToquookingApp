import { useMemo, useState } from "react";
import type { Recipe, SeasonalThreshold } from "../types";
import { countSeasonalIngredientMatches, currentSeasonalIngredients } from "../seasonal";
import { originMatchesFilter } from "../origins";
import { recipeMatchesQuery } from "../utils/recipes";

export function useRecipeFilters(recipes: Recipe[]) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [seasonalThreshold, setSeasonalThreshold] = useState<SeasonalThreshold>(0);

  const seasonalIngredients = currentSeasonalIngredients();

  const allTags = useMemo(
    () => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b, "fr")),
    [recipes],
  );

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
        const tagMatches = !tagFilter || recipe.tags.includes(tagFilter);
        const originMatches = originMatchesFilter(recipe.origin, originFilter);
        const seasonMatches =
          seasonalThreshold === 0 || (seasonalMatchCounts.get(recipe.id) ?? 0) >= seasonalThreshold;
        return recipeMatchesQuery(recipe, query) && tagMatches && originMatches && seasonMatches;
      }),
    [recipes, query, tagFilter, originFilter, seasonalThreshold, seasonalMatchCounts],
  );

  return {
    query,
    setQuery,
    tagFilter,
    setTagFilter,
    originFilter,
    setOriginFilter,
    seasonalThreshold,
    setSeasonalThreshold,
    allTags,
    seasonalMatchCounts,
    seasonalRecipeIds,
    filteredRecipes,
  };
}

export type RecipeFiltersApi = ReturnType<typeof useRecipeFilters>;
