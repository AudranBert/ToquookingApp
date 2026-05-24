import { useCallback, useEffect, useState } from "react";
import { db } from "../db";
import type { Recipe, RecipeDraft } from "../types";
import { createId } from "../utils/id";
import { cleanRecipeDraft, nowIso } from "../utils/recipes";
import { parseBackupFile } from "../utils/backup";
import type { StatusApi } from "./useStatus";

export function useRecipes(status: StatusApi) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const refresh = useCallback(async (nextSelectedId?: string) => {
    const next = await db.recipes.orderBy("updatedAt").reverse().toArray();
    setRecipes(next);
    return nextSelectedId;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (draft: RecipeDraft, editingId: string | null): Promise<Recipe | null> => {
      const cleaned = cleanRecipeDraft(draft);
      if (!cleaned.name) {
        status.setStatus("Ajoute au minimum un nom.");
        return null;
      }
      const existing = editingId ? await db.recipes.get(editingId) : undefined;
      const recipe: Recipe = {
        ...cleaned,
        id: editingId ?? createId(),
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };

      try {
        await db.recipes.put(recipe);
        await refresh();
        status.setStatus(editingId ? "Recette mise a jour." : "Recette enregistree.");
        return recipe;
      } catch (firstError) {
        try {
          if (db.isOpen()) db.close();
          await db.open();
          await db.recipes.put(recipe);
          await refresh();
          status.setStatus(editingId ? "Recette mise a jour." : "Recette enregistree.");
          return recipe;
        } catch (retryError) {
          const error = retryError ?? firstError;
          const details =
            error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : "erreur inconnue";
          status.setStatus(`Enregistrement impossible (${details}).`);
          return null;
        }
      }
    },
    [refresh, status],
  );

  const remove = useCallback(
    async (recipe: Recipe) => {
      await db.recipes.delete(recipe.id);
      await refresh();
      status.setStatus("Recette supprimee.");
      return true;
    },
    [refresh, status],
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

      await db.recipes.put(copy);
      await refresh();
      status.setStatus("Recette dupliquee.");
      return copy;
    },
    [refresh, status],
  );

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const imported = await parseBackupFile(file, await db.recipes.toArray());
        await db.recipes.bulkPut(imported.recipes);
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
          }),
        );
        await refresh();
        status.setStatus(`${imported.recipes.length} recette(s) importee(s).`);
        return imported.recipes[0]?.id;
      } catch {
        status.setStatus("Le fichier de sauvegarde n'est pas lisible.");
        return undefined;
      }
    },
    [refresh, status],
  );

  return { recipes, refresh, save, remove, duplicate, importBackup };
}
