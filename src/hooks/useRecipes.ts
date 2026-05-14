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
    refresh();
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

      await db.recipes.put(recipe);
      await refresh();
      status.setStatus(editingId ? "Recette mise à jour." : "Recette enregistrée.");
      return recipe;
    },
    [refresh, status],
  );

  const remove = useCallback(
    async (recipe: Recipe) => {
      if (!window.confirm(`Supprimer "${recipe.name}" ?`)) return false;
      await db.recipes.delete(recipe.id);
      await refresh();
      status.setStatus("Recette supprimée.");
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
      status.setStatus("Recette dupliquée.");
      return copy;
    },
    [refresh, status],
  );

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const imported = await parseBackupFile(file, await db.recipes.toArray());
        await db.recipes.bulkPut(imported);
        await refresh();
        status.setStatus(`${imported.length} recette(s) importée(s).`);
        return imported[0]?.id;
      } catch {
        status.setStatus("Le fichier de sauvegarde n'est pas lisible.");
        return undefined;
      }
    },
    [refresh, status],
  );

  return { recipes, refresh, save, remove, duplicate, importBackup };
}
