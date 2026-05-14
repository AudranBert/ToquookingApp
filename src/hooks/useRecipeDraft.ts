import { useState } from "react";
import { importRecipeFromUrl } from "../importer";
import type { ParsedRecipe, Recipe, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";
import { createEmptyDraft, recipeToDraft } from "../utils/recipes";
import type { StatusApi } from "./useStatus";

export function useRecipeDraft(status: StatusApi) {
  const [draft, setDraft] = useState<RecipeDraft>(createEmptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState("");

  function startNew() {
    setEditingId(null);
    setDraft(createEmptyDraft());
    setImportWarnings([]);
  }

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setDraft(recipeToDraft(recipe));
    setImportWarnings([]);
  }

  async function importFromUrl() {
    const url = importUrl.trim();
    if (!url) return false;
    status.setStatus("Import en cours...");

    try {
      const parsed = await importRecipeFromUrl(url);
      setDraft(parsedToDraft(parsed, url));
      setEditingId(null);
      setImportWarnings(parsed.warnings ?? []);
      status.setStatus("Import préparé. Vérifie les champs avant d'enregistrer.");
      return true;
    } catch {
      status.setStatus("Import impossible pour ce lien. Tu peux quand même remplir la recette manuellement.");
      return false;
    }
  }

  async function reimport(mode: ReimportMode) {
    const url = draft.sourceUrl?.trim();
    if (!url) {
      status.setStatus("Ajoute un lien source avant de réimporter.");
      return;
    }
    status.setStatus("Réimport en cours...");

    try {
      const parsed = await importRecipeFromUrl(url);
      const imported = parsedToDraft(parsed, url);
      setDraft((current) => (mode === "replace" ? imported : mergeBlanks(current, imported)));
      setImportWarnings(parsed.warnings ?? []);
      status.setStatus(
        mode === "replace" ? "Champs remplacés depuis le lien." : "Champs vides complétés depuis le lien.",
      );
    } catch {
      status.setStatus("Réimport impossible pour ce lien.");
    }
  }

  return {
    draft,
    setDraft,
    editingId,
    importWarnings,
    importUrl,
    setImportUrl,
    startNew,
    startEdit,
    importFromUrl,
    reimport,
  };
}

function parsedToDraft(parsed: ParsedRecipe, fallbackUrl: string): RecipeDraft {
  return {
    ...createEmptyDraft(),
    ...parsed,
    sourceUrl: parsed.sourceUrl ?? fallbackUrl,
    videoUrl: parsed.videoUrl,
    tags: parsed.tags ?? [],
    ingredients: parsed.ingredients?.length ? parsed.ingredients : [{ id: createId(), name: "" }],
    instructions: parsed.instructions?.length ? parsed.instructions : [""],
  };
}

function mergeBlanks(current: RecipeDraft, imported: RecipeDraft): RecipeDraft {
  return {
    ...current,
    name: current.name || imported.name,
    sourceUrl: current.sourceUrl || imported.sourceUrl,
    videoUrl: current.videoUrl || imported.videoUrl,
    servings: current.servings ?? imported.servings,
    prepTime: current.prepTime ?? imported.prepTime,
    cookTime: current.cookTime ?? imported.cookTime,
    totalTime: current.totalTime ?? imported.totalTime,
    notes: current.notes || imported.notes,
    imageUrl: current.imageUrl || imported.imageUrl,
    tags: current.tags.length ? current.tags : imported.tags,
    ingredients: hasFilledIngredients(current) ? current.ingredients : imported.ingredients,
    instructions: current.instructions.some((step) => step.trim()) ? current.instructions : imported.instructions,
  };
}

function hasFilledIngredients(draft: RecipeDraft) {
  return draft.ingredients.some((ingredient) =>
    [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.note].some((value) => value?.trim()),
  );
}
