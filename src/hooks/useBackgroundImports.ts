import { useCallback, useEffect, useRef } from "react";
import { db } from "../db";
import { putRecipe } from "../data/recipeRepository";
import { importRecipeFromUrl } from "../importer";
import {
  completePendingImport,
  createPendingImport,
  failPendingImport,
  hasImportedContent,
} from "../import/background";
import { t } from "../i18n";
import type { ParsedRecipe, Recipe } from "../types";
import type { StatusApi } from "./useStatus";

export function useBackgroundImports(
  recipes: Recipe[],
  knownTags: string[],
  refresh: () => Promise<unknown>,
  status: StatusApi,
  onOpen: (recipe: Recipe) => void,
  onEdit: (recipe: Recipe) => void
) {
  const active = useRef(new Set<string>());
  const { setStatus, clear } = status;

  const run = useCallback(
    async (recipe: Recipe) => {
      let completed: Recipe | undefined;
      let failed: Recipe | undefined;
      try {
        let parsed: ParsedRecipe | undefined;
        let errorMessage: string | undefined;
        try {
          parsed = await importRecipeFromUrl(recipe.sourceUrl ?? "");
          if (!hasImportedContent(parsed))
            errorMessage = parsed.warnings?.join(" ") || t("import.background.noContent");
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : t("import.background.noContent");
        }
        // Read and merge atomically, preserving edits/deletes made during the request.
        await db.transaction("rw", db.recipes, db.cloudQueue, async () => {
          const current = await db.recipes.get(recipe.id);
          if (!current || current.importStatus !== "pending") return;
          if (errorMessage || !parsed) {
            failed = failPendingImport(current, errorMessage || t("import.background.noContent"));
            await db.recipes.put(failed);
          } else {
            completed = completePendingImport(current, parsed, knownTags);
            await putRecipe(completed);
          }
        });
        await refresh();
        if (completed) {
          const result = completed;
          setStatus(
            [
              t("import.background.completed", { name: result.name }),
              ...(parsed?.warnings ?? []),
            ].join(" "),
            () => {
              onOpen(result);
              clear();
            },
            8_000
          );
        } else if (failed) {
          const result = failed;
          setStatus(
            t("import.background.failed", { name: result.name }),
            () => {
              onEdit(result);
              clear();
            },
            8_000
          );
        }
      } catch {
        setStatus(t("import.background.createFailed"));
      } finally {
        active.current.delete(recipe.id);
      }
    },
    [knownTags, refresh, setStatus, clear, onOpen, onEdit]
  );

  useEffect(() => {
    for (const recipe of recipes) {
      if (recipe.importStatus !== "pending" || active.current.has(recipe.id)) continue;
      active.current.add(recipe.id);
      void run(recipe);
    }
  }, [recipes, run]);

  async function enqueue(url: string) {
    const pending = createPendingImport(url);
    await db.recipes.put(pending);
    await refresh();
    return pending;
  }

  return { enqueue };
}
