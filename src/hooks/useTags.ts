import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import type { Recipe, RecipeTag } from "../types";
import { normalizeText } from "../utils/text";
import { nowIso } from "../utils/recipes";
import type { StatusApi } from "./useStatus";

const DEFAULT_PROTECTED_TAGS = [
  "omnivore",
  "végétarien",
  "végétalien",
  "pescétarien",
  "entrée",
  "plat",
  "dessert",
  "boisson",
  "froid",
  "chaud",
  "accompagnement",
  "apéritif",
] as const;

function sortTags(tags: string[]) {
  return [...tags].sort((a, b) => a.localeCompare(b, "fr"));
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  tags.forEach((tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const key = normalizeText(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(trimmed);
  });
  return unique;
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
  const protectedTagKeys = useMemo(() => new Set(DEFAULT_PROTECTED_TAGS.map((tag) => normalizeText(tag))), []);

  const refresh = useCallback(async () => {
    const stored = await db.tags.orderBy("name").toArray();
    setTags(sortTags(uniqueTags([...stored.map((tag) => tag.name), ...DEFAULT_PROTECTED_TAGS])));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    db.tags
      .bulkPut(
        DEFAULT_PROTECTED_TAGS.map<RecipeTag>((name) => ({
          name,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })),
      )
      .then(refresh);
  }, [refresh]);

  useEffect(() => {
    const recipeTags = uniqueRecipeTags(recipes);
    if (recipeTags.length === 0) return;

    db.tags
      .bulkPut(
        recipeTags.map<RecipeTag>((name) => ({
          name,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })),
      )
      .then(refresh);
  }, [recipes, refresh]);

  const allTags = useMemo(() => sortTags(uniqueTags([...tags, ...DEFAULT_PROTECTED_TAGS])), [tags]);
  const isProtectedTag = useCallback((name: string) => protectedTagKeys.has(normalizeText(name)), [protectedTagKeys]);

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
      if (isProtectedTag(name)) {
        status.setStatus("Ce tag par défaut est protégé et ne peut pas être supprimé.");
        return;
      }

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
    [isProtectedTag, onRecipesChanged, refresh, status],
  );

  return { allTags, protectedTags: DEFAULT_PROTECTED_TAGS, isProtectedTag, createTag, renameTag, deleteTag };
}
