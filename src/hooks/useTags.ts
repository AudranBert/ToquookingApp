import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import type { Recipe, RecipeTag } from "../types";
import { normalizeText } from "../utils/text";
import { nowIso } from "../utils/recipes";
import type { StatusApi } from "./useStatus";

function sortTags(tags: string[]) {
  return [...tags].sort((a, b) => a.localeCompare(b, "fr"));
}

function uniqueRecipeTags(recipes: Recipe[]) {
  const seen = new Map<string, string>();
  recipes.flatMap((recipe) => recipe.tags).forEach((tag) => {
    const trimmed = tag.trim();
    if (trimmed) seen.set(normalizeText(trimmed), trimmed);
  });
  return [...seen.values()];
}

export function useTags(recipes: Recipe[], status: StatusApi, onRecipesChanged: () => Promise<unknown>) {
  const [tags, setTags] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const stored = await db.tags.orderBy("name").toArray();
    setTags(sortTags(stored.map((tag) => tag.name)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const recipeTags = uniqueRecipeTags(recipes);
    if (recipeTags.length === 0) return;

    db.tags.bulkPut(
      recipeTags.map<RecipeTag>((name) => ({
        name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
    ).then(refresh);
  }, [recipes, refresh]);

  const allTags = useMemo(() => sortTags(tags), [tags]);

  const createTag = useCallback(
    async (rawName: string) => {
      const name = rawName.trim();
      if (!name) return undefined;

      const existing = allTags.find((tag) => normalizeText(tag) === normalizeText(name));
      if (existing) return existing;

      await db.tags.put({ name, createdAt: nowIso(), updatedAt: nowIso() });
      await refresh();
      status.setStatus("Tag ajoute.");
      return name;
    },
    [allTags, refresh, status],
  );

  const renameTag = useCallback(
    async (oldName: string, rawNewName: string) => {
      const newName = rawNewName.trim();
      if (!newName || normalizeText(newName) === normalizeText(oldName)) return oldName;

      const existing = allTags.find((tag) => normalizeText(tag) === normalizeText(newName));
      if (existing && existing !== oldName) {
        status.setStatus("Ce tag existe deja.");
        return oldName;
      }

      await db.transaction("rw", db.tags, db.recipes, async () => {
        await db.tags.delete(oldName);
        await db.tags.put({ name: newName, createdAt: nowIso(), updatedAt: nowIso() });
        const affected = await db.recipes.filter((recipe) => recipe.tags.includes(oldName)).toArray();
        await db.recipes.bulkPut(
          affected.map((recipe) => ({
            ...recipe,
            tags: recipe.tags.map((tag) => (tag === oldName ? newName : tag)),
            updatedAt: nowIso(),
          })),
        );
      });
      await refresh();
      await onRecipesChanged();
      status.setStatus("Tag renomme.");
      return newName;
    },
    [allTags, onRecipesChanged, refresh, status],
  );

  const deleteTag = useCallback(
    async (name: string) => {
      await db.transaction("rw", db.tags, db.recipes, async () => {
        await db.tags.delete(name);
        const affected = await db.recipes.filter((recipe) => recipe.tags.includes(name)).toArray();
        await db.recipes.bulkPut(
          affected.map((recipe) => ({
            ...recipe,
            tags: recipe.tags.filter((tag) => tag !== name),
            updatedAt: nowIso(),
          })),
        );
      });
      await refresh();
      await onRecipesChanged();
      status.setStatus("Tag supprime des recettes.");
    },
    [onRecipesChanged, refresh, status],
  );

  return { allTags, createTag, renameTag, deleteTag };
}
