import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db";
import { putRecipe, putRecipes, deleteRecipe } from "../data/recipeRepository";
import type { Recipe, RecipeDraft } from "../types";
import { createId } from "../utils/id";
import { cleanRecipeDraft, cleanStoredRecipe, nowIso } from "../utils/recipes";
import { parseBackupFile } from "../utils/backup";
import { t } from "../i18n";
import type { StatusApi } from "./useStatus";

export function useRecipes(status: StatusApi) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  const refresh = useCallback(async (nextSelectedId?: string) => {
    const stored = await db.recipes.orderBy("updatedAt").reverse().toArray();
    const next = stored.map(cleanStoredRecipe);
    const normalized = next.filter(
      (recipe, index) => JSON.stringify(recipe) !== JSON.stringify(stored[index])
    );
    if (normalized.length > 0) {
      await db.recipes.bulkPut(normalized);
    }
    setRecipes(next);
    return nextSelectedId;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (draft: RecipeDraft, editingId: string | null): Promise<Recipe | null> => {
      if (saving.current) return null;
      saving.current = true;
      setIsSaving(true);
      try {
        const cleaned = cleanRecipeDraft(draft);
        if (!cleaned.name) {
          status.setStatus(t("recipe.status.nameRequired"));
          return null;
        }
        const existing = editingId ? await db.recipes.get(editingId) : undefined;
        const recipe: Recipe = {
          ...cleaned,
          id: editingId ?? createId(),
          createdAt: existing?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        };
        await putRecipe(recipe);
        await refresh();
        status.setStatus(t(editingId ? "recipe.status.updated" : "recipe.status.saved"));
        return recipe;
      } catch {
        status.setStatus(t("recipe.status.saveFailed"));
        return null;
      } finally {
        saving.current = false;
        setIsSaving(false);
      }
    },
    [refresh, status]
  );

  const remove = useCallback(
    async (recipe: Recipe) => {
      await deleteRecipe(recipe.id);
      await refresh();
      status.setStatus("Recette supprimée.");
      return true;
    },
    [refresh, status]
  );

  const duplicate = useCallback(
    async (recipe: Recipe) => {
      const copy: Recipe = {
        ...recipe,
        id: createId(),
        name: `${recipe.name} (copie)`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      await putRecipe(copy);
      await refresh();
      status.setStatus("Recette dupliquée.");
      return copy;
    },
    [refresh, status]
  );

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const imported = await parseBackupFile(file, await db.recipes.toArray());
        await db.transaction("rw", db.recipes, db.tags, db.cloudQueue, async () => {
          await putRecipes(imported.recipes.map(cleanStoredRecipe));
          const existingTags = await db.tags.toArray();
          const existingByName = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]));
          await db.tags.bulkPut(
            imported.tags.map((tag) => {
              const existing = existingByName.get(tag.name.toLowerCase());
              return {
                id: existing?.id ?? createId(),
                name: existing?.name ?? tag.name,
                category: tag.category ?? existing?.category,
                color: tag.color ?? existing?.color,
                createdAt: existing?.createdAt ?? nowIso(),
                updatedAt: nowIso(),
              };
            })
          );
        });
        await refresh();
        status.setStatus(`${imported.recipes.length} recette(s) importée(s).`);
        return imported.recipes[0]?.id;
      } catch {
        status.setStatus("Le fichier de sauvegarde n'est pas lisible.");
        return undefined;
      }
    },
    [refresh, status]
  );

  return { recipes, isSaving, refresh, save, remove, duplicate, importBackup };
}
