import { useState } from "react";
import { importRecipeFromUrl } from "../importer";
import type { ParsedRecipe, Recipe, RecipeDraft, ReimportMode } from "../types";
import { createId } from "../utils/id";
import { createEmptyDraft, recipeToDraft } from "../utils/recipes";
import { normalizeText } from "../utils/text";
import type { StatusApi } from "./useStatus";

export function useRecipeDraft(status: StatusApi, allTags: string[]) {
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

    return runImport({
      url,
      loadingStatus: "Import en cours...",
      successStatus: "Import préparé. Vérifie les champs avant d'enregistrer.",
      errorStatus: "Import impossible pour ce lien. Tu peux quand même remplir la recette manuellement.",
      apply: (imported) => {
        setDraft(imported);
        setEditingId(null);
      },
    });
  }

  async function reimport(mode: ReimportMode) {
    const url = draft.sourceUrl?.trim();
    if (!url) {
      status.setStatus("Ajoute un lien source avant de réimporter.");
      return;
    }

    await runImport({
      url,
      loadingStatus: "Réimport en cours...",
      successStatus: mode === "replace" ? "Champs remplacés depuis le lien." : "Champs vides complétés depuis le lien.",
      errorStatus: "Réimport impossible pour ce lien.",
      apply: (imported) => setDraft((current) => (mode === "replace" ? imported : mergeBlanks(current, imported))),
    });
  }

  async function runImport({
    url,
    loadingStatus,
    successStatus,
    errorStatus,
    apply,
  }: {
    url: string;
    loadingStatus: string;
    successStatus: string;
    errorStatus: string;
    apply: (imported: RecipeDraft) => void;
  }) {
    status.setStatus(loadingStatus);
    try {
      const parsed = await importRecipeFromUrl(url);
      const imported = parsedToDraft(parsed, url, allTags);
      apply(imported);
      setImportWarnings(parsed.warnings ?? []);
      status.setStatus(successStatus);
      return true;
    } catch {
      status.setStatus(errorStatus);
      return false;
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

function parsedToDraft(parsed: ParsedRecipe, fallbackUrl: string, allTags: string[]): RecipeDraft {
  const imageUrl = parsed.imageUrl;

  return {
    ...createEmptyDraft(),
    ...parsed,
    sourceUrl: parsed.sourceUrl ?? fallbackUrl,
    videoUrl: parsed.videoUrl,
    imageUrl,
    sourceImageUrl: imageUrl,
    tags: matchKnownTags(parsed.tags ?? [], allTags),
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
    restTime: current.restTime ?? imported.restTime,
    cookTime: current.cookTime ?? imported.cookTime,
    totalTime: current.totalTime ?? imported.totalTime,
    notes: current.notes || imported.notes,
    imageUrl: current.imageUrl || imported.imageUrl,
    sourceImageUrl: current.sourceImageUrl || imported.sourceImageUrl,
    origin: current.origin || imported.origin,
    tags: current.tags.length ? current.tags : imported.tags,
    ingredients: hasFilledIngredients(current) ? current.ingredients : imported.ingredients,
    instructions: current.instructions.some((step) => step.trim()) ? current.instructions : imported.instructions,
  };
}

function matchKnownTags(importedTags: string[], allTags: string[]) {
  const known = new Map(allTags.map((tag) => [normalizeText(tag), tag]));
  const matched = new Map<string, string>();

  importedTags.forEach((tag) => {
    const exact = known.get(normalizeText(tag));
    if (exact) matched.set(normalizeText(exact), exact);
  });

  return [...matched.values()];
}

function hasFilledIngredients(draft: RecipeDraft) {
  return draft.ingredients.some((ingredient) =>
    [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.note].some((value) => value?.trim()),
  );
}
