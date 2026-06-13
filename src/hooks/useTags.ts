import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import { t } from "../i18n";
import type { Recipe, RecipeTag } from "../types";
import { DEFAULT_RECIPE_TOOLS } from "../constants";
import { createId } from "../utils/id";
import { nowIso } from "../utils/recipes";
import { formatTagName } from "../utils/tags";
import { normalizeText } from "../utils/text";
import type { StatusApi } from "./useStatus";

function defaultProtectedTags() {
  const dietCategory = t("manage.category.diet");
  const mealTypeCategory = t("manage.category.mealType");
  const toolsCategory = t("manage.category.tools");
  return [
    { name: "omnivore", category: dietCategory },
    { name: "pescétarien", category: dietCategory },
    { name: "végétarien", category: dietCategory },
    { name: "végétalien", category: dietCategory },
    { name: "entrée", category: mealTypeCategory },
    { name: "boisson", category: mealTypeCategory },
    { name: "apéritif", category: mealTypeCategory },
    { name: "plat", category: mealTypeCategory },
    { name: "accompagnement", category: mealTypeCategory },
    { name: "dessert", category: mealTypeCategory },
    { name: "chaud", category: mealTypeCategory },
    { name: "froid", category: mealTypeCategory },
    ...DEFAULT_RECIPE_TOOLS.map((name) => ({ name, category: toolsCategory })),
  ].map((tag) => ({ ...tag, name: formatTagName(tag.name) }));
}

const TAG_MOJIBAKE_FIXES: Record<string, string> = {
  "entrÃ©e": "entrée",
  "apÃ©ritif": "apéritif",
  "pescÃ©tarien": "pescétarien",
  "vÃ©gÃ©tarien": "végétarien",
  "vÃ©gÃ©talien": "végétalien",
};

function repairTagName(value: string) {
  const trimmed = value.trim();
  return TAG_MOJIBAKE_FIXES[trimmed] ?? trimmed;
}

export type TagCategory = {
  name: string;
  color?: string;
  tags: RecipeTag[];
};

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = normalizeText(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(formatTagName(trimmed));
  });
  return unique;
}

function uniqueRecipeTags(recipes: Recipe[]) {
  return uniqueByNormalized(recipes.flatMap((recipe) => recipe.tags.map(formatTagName)));
}

export function useTags(recipes: Recipe[], status: StatusApi, onRecipesChanged: () => Promise<unknown>) {
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const protectedDefaults = defaultProtectedTags();
  const protectedTagKeys = useMemo(
    () => new Set(protectedDefaults.map((tag) => normalizeText(tag.name))),
    [protectedDefaults],
  );

  const refresh = useCallback(async () => {
    const stored = await db.tags.toArray();
    const byName = new Map<string, RecipeTag>();
    for (const tag of stored) {
      byName.set(normalizeText(tag.name), tag);
    }
    setTags([...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr")));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void db
      .transaction("rw", db.tags, async () => {
        const now = nowIso();
        const existing = await db.tags.toArray();
        const recipesToFix = await db.recipes.toArray();
        const repairedTags = existing
          .map((tag) => {
            const repaired = formatTagName(tag.name);
            return repaired === tag.name ? null : { ...tag, name: repaired, updatedAt: now };
          })
          .filter((tag): tag is RecipeTag => Boolean(tag));
        if (repairedTags.length > 0) await db.tags.bulkPut(repairedTags);
        const repairedRecipes = recipesToFix
          .map((recipe) => {
            const nextTags = recipe.tags.map(formatTagName);
            const changed = nextTags.some((value, index) => value !== recipe.tags[index]);
            return changed ? { ...recipe, tags: uniqueByNormalized(nextTags), updatedAt: now } : null;
          })
          .filter((recipe): recipe is Recipe => Boolean(recipe));
        if (repairedRecipes.length > 0) await db.recipes.bulkPut(repairedRecipes);

        const refreshedTags = repairedTags.length > 0 ? await db.tags.toArray() : existing;
        const byKey = new Map(refreshedTags.map((tag) => [normalizeText(tag.name), tag]));
        const queuedKeys = new Set<string>();
        const toUpsert: RecipeTag[] = [];

        for (const defaultTag of protectedDefaults) {
          const key = normalizeText(defaultTag.name);
          const current = byKey.get(key);
          if (queuedKeys.has(key)) continue;
          if (!current) {
            toUpsert.push({
              id: createId(),
              name: defaultTag.name,
              category: defaultTag.category,
              createdAt: now,
              updatedAt: now,
            });
            queuedKeys.add(key);
          } else if (current.name !== defaultTag.name || current.category !== defaultTag.category) {
            toUpsert.push({ ...current, name: defaultTag.name, category: defaultTag.category, updatedAt: now });
            queuedKeys.add(key);
          }
        }

        for (const name of uniqueRecipeTags(recipes)) {
          const key = normalizeText(name);
          const current = byKey.get(key);
          if (queuedKeys.has(key)) continue;
          if (!current) {
            toUpsert.push({ id: createId(), name, createdAt: now, updatedAt: now });
            queuedKeys.add(key);
          } else if (current.name !== name) {
            toUpsert.push({ ...current, name, updatedAt: now });
            queuedKeys.add(key);
          }
        }

        if (toUpsert.length > 0) await db.tags.bulkPut(toUpsert);
      })
      .then(refresh);
  }, [recipes, refresh, protectedDefaults]);

  const allTags = useMemo(() => tags.map((tag) => tag.name), [tags]);

  const categories = useMemo(() => {
    const groups = new Map<string, TagCategory>();
    for (const tag of tags) {
      const categoryName = tag.category?.trim() || t("manage.tag.none");
      const key = normalizeText(categoryName);
      const group = groups.get(key) ?? { name: categoryName, color: undefined, tags: [] };
      group.tags.push(tag);
      if (tag.color && !group.color) group.color = tag.color;
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({ ...group, tags: group.tags.sort((a, b) => a.name.localeCompare(b.name, "fr")) }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [tags]);

  const isProtectedTag = useCallback((name: string) => protectedTagKeys.has(normalizeText(name)), [protectedTagKeys]);

  const createTag = useCallback(
    async (rawName: string, category?: string) => {
      const name = formatTagName(rawName);
      if (!name) return undefined;
      const existing = tags.find((tag) => normalizeText(tag.name) === normalizeText(name));
      if (existing) return existing.name;
      await db.tags.put({
        id: createId(),
        name,
        category: category?.trim() || undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      await refresh();
      status.setStatus(t("manage.status.tagAdded"));
      return name;
    },
    [refresh, status, tags],
  );

  const renameTag = useCallback(
    async (oldName: string, rawNewName: string) => {
      const newName = formatTagName(rawNewName);
      if (!newName || normalizeText(newName) === normalizeText(oldName)) return oldName;

      const source = tags.find((tag) => normalizeText(tag.name) === normalizeText(oldName));
      if (!source) return oldName;
      const target = tags.find((tag) => normalizeText(tag.name) === normalizeText(newName));
      if (target && target.id !== source.id) {
        status.setStatus(t("manage.status.tagAlreadyExists"));
        return oldName;
      }

      await db.transaction("rw", db.tags, db.recipes, async () => {
        await db.tags.put({ ...source, name: newName, updatedAt: nowIso() });
        const affected = await db.recipes.filter((recipe) => recipe.tags.includes(oldName)).toArray();
        if (affected.length > 0) {
          await db.recipes.bulkPut(
            affected.map((recipe) => ({
              ...recipe,
              tags: recipe.tags.map((tag) => (tag === oldName ? newName : tag)),
              updatedAt: nowIso(),
            })),
          );
        }
      });
      await refresh();
      await onRecipesChanged();
      status.setStatus(t("manage.status.tagRenamed"));
      return newName;
    },
    [onRecipesChanged, refresh, status, tags],
  );

  const mergeTags = useCallback(
    async (sourceName: string, targetName: string) => {
      const source = tags.find((tag) => normalizeText(tag.name) === normalizeText(sourceName));
      if (!source) return;
      const nextTarget = formatTagName(targetName);
      if (!nextTarget) return;
      const existingTarget = tags.find((tag) => normalizeText(tag.name) === normalizeText(nextTarget));
      const resolvedTargetName = existingTarget?.name ?? nextTarget;
      if (normalizeText(source.name) === normalizeText(resolvedTargetName)) return;

      await db.transaction("rw", db.tags, db.recipes, async () => {
        if (!existingTarget) {
          await db.tags.put({
            id: createId(),
            name: resolvedTargetName,
            category: source.category,
            color: source.color,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        }

        const affected = await db.recipes.filter((recipe) => recipe.tags.includes(source.name)).toArray();
        if (affected.length > 0) {
          await db.recipes.bulkPut(
            affected.map((recipe) => {
              const replaced = recipe.tags.map((tag) => (tag === source.name ? resolvedTargetName : tag));
              return {
                ...recipe,
                tags: uniqueByNormalized(replaced),
                updatedAt: nowIso(),
              };
            }),
          );
        }
        await db.tags.delete(source.id);
      });

      await refresh();
      await onRecipesChanged();
      status.setStatus(t("manage.status.tagsMerged"));
    },
    [onRecipesChanged, refresh, status, tags],
  );

  const deleteTag = useCallback(
    async (name: string) => {
      const source = tags.find((tag) => normalizeText(tag.name) === normalizeText(name));
      if (!source) return;
      if (isProtectedTag(source.name)) {
        status.setStatus(t("app.status.defaultTagProtected"));
        return;
      }
      await db.transaction("rw", db.tags, db.recipes, async () => {
        await db.tags.delete(source.id);
        const affected = await db.recipes.filter((recipe) => recipe.tags.includes(source.name)).toArray();
        if (affected.length > 0) {
          await db.recipes.bulkPut(
            affected.map((recipe) => ({
              ...recipe,
              tags: recipe.tags.filter((tag) => tag !== source.name),
              updatedAt: nowIso(),
            })),
          );
        }
      });
      await refresh();
      await onRecipesChanged();
      status.setStatus(t("manage.status.tagDeletedFromRecipes"));
    },
    [isProtectedTag, onRecipesChanged, refresh, status, tags],
  );

  const updateTagMeta = useCallback(
    async (name: string, nextMeta: { category?: string; color?: string }) => {
      const source = tags.find((tag) => normalizeText(tag.name) === normalizeText(name));
      if (!source) return;
      await db.tags.put({
        ...source,
        category: nextMeta.category?.trim() || undefined,
        color: nextMeta.color?.trim() || undefined,
        updatedAt: nowIso(),
      });
      await refresh();
      status.setStatus(t("manage.status.tagUpdated"));
    },
    [refresh, status, tags],
  );

  return {
    tags,
    allTags,
    categories,
    protectedTags: protectedDefaults.map((tag) => tag.name),
    isProtectedTag,
    createTag,
    renameTag,
    mergeTags,
    deleteTag,
    updateTagMeta,
  };
}
