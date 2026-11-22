import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { importRecipeFromText, importRecipeFromUrl } from "../importer";
import type { Recipe, RecipeDraft, ReimportMode } from "../types";
import { mergedRecipeImageUrls } from "../utils/images";
import { createEmptyDraft, recipeToDraft } from "../utils/recipes";
import { parsedToDraft } from "../import/recipeDraft";
import type { StatusApi } from "./useStatus";

export function useRecipeDraft(status: StatusApi, allTags: string[]) {
  const [draft, setDraft] = useState<RecipeDraft>(createEmptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const importVersion = useRef(0);
  const baseline = useRef(JSON.stringify(draft));
  const hasChanges =
    JSON.stringify(draft) !== baseline.current || Boolean(importText.trim() || importUrl.trim());

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  function startNew() {
    importVersion.current++;
    setIsImporting(false);
    setEditingId(null);
    const empty = createEmptyDraft();
    baseline.current = JSON.stringify(empty);
    setDraft(empty);
    setImportWarnings([]);
    setImportText("");
    setImportUrl("");
  }

  function startEdit(recipe: Recipe) {
    importVersion.current++;
    setIsImporting(false);
    setEditingId(recipe.id);
    const next = recipeToDraft(recipe);
    baseline.current = JSON.stringify(next);
    setDraft(next);
    setImportWarnings([]);
    setImportText("");
    setImportUrl("");
  }

  async function reimport(mode: ReimportMode) {
    const url = draft.sourceUrl?.trim();
    if (!url) {
      status.setStatus(t("import.status.reimportMissingSource"));
      return;
    }

    await runImport({
      url,
      loadingStatus: t("import.status.reimportLoading"),
      successStatus:
        mode === "replace"
          ? t("import.status.reimportReplaceSuccess")
          : t("import.status.reimportFillSuccess"),
      errorStatus: t("import.status.reimportError"),
      apply: (imported) =>
        setDraft((current) => (mode === "replace" ? imported : mergeBlanks(current, imported))),
    });
  }

  function importFromText() {
    const text = importText.trim();
    if (!text) return false;
    return importFromRawText(text);
  }

  function importFromRawText(rawText: string) {
    const text = rawText.trim();
    if (!text) return false;

    status.setStatus(t("import.status.textLoading"));
    try {
      const parsed = importRecipeFromText(text);
      const imported = parsedToDraft(parsed, parsed.sourceUrl ?? "", allTags);
      setDraft(imported);
      setEditingId(null);
      setImportWarnings(parsed.warnings ?? []);
      status.setStatus(t("import.status.textSuccess"));
      return true;
    } catch {
      status.setStatus(t("import.status.textError"));
      return false;
    }
  }

  function importFromRecipe(recipe: Recipe) {
    setDraft(recipeToDraft(recipe));
    setEditingId(null);
    setImportWarnings([]);
    setImportText("");
    status.setStatus(t("import.status.fileSuccess"));
    return true;
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
    if (isImporting) return false;
    const version = ++importVersion.current;
    setIsImporting(true);
    status.setStatus(loadingStatus);
    try {
      const parsed = await importRecipeFromUrl(url);
      if (version !== importVersion.current) return false;
      const imported = parsedToDraft(parsed, url, allTags);
      apply(imported);
      setImportWarnings(parsed.warnings ?? []);
      status.setStatus(
        parsed.ingredients?.length || parsed.instructions?.length ? successStatus : errorStatus
      );
      return true;
    } catch (error) {
      if (version !== importVersion.current) return false;
      status.setStatus(`${errorStatus} (${classifyImportError(error)})`);
      return false;
    } finally {
      if (version === importVersion.current) setIsImporting(false);
    }
  }

  return {
    draft,
    hasChanges,
    isImporting,
    setDraft,
    editingId,
    importWarnings,
    importUrl,
    setImportUrl,
    importText,
    setImportText,
    startNew,
    startEdit,
    importFromText,
    importFromRawText,
    importFromRecipe,
    reimport,
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
    imageUrls: mergedRecipeImageUrls({
      imageUrl: current.imageUrl || imported.imageUrl,
      imageUrls: (current.imageUrls?.length ? current.imageUrls : imported.imageUrls) ?? [],
    }),
    sourceImageUrl: current.sourceImageUrl || imported.sourceImageUrl,
    sourceImageUrls: mergedRecipeImageUrls({
      imageUrl: current.sourceImageUrl || imported.sourceImageUrl,
      imageUrls:
        (current.sourceImageUrls?.length ? current.sourceImageUrls : imported.sourceImageUrls) ??
        [],
    }),
    origin: current.origin || imported.origin,
    tags: current.tags.length ? current.tags : imported.tags,
    ingredients: hasFilledIngredients(current) ? current.ingredients : imported.ingredients,
    instructions: current.instructions.some((step) => step.trim())
      ? current.instructions
      : imported.instructions,
  };
}

function hasFilledIngredients(draft: RecipeDraft) {
  return draft.ingredients.some((ingredient) =>
    [ingredient.quantity, ingredient.unit, ingredient.name, ingredient.note].some((value) =>
      value?.trim()
    )
  );
}

function classifyImportError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (/failed to fetch|network|cors|timeout|dns|internet/.test(message))
    return t("import.error.network");
  if (/unsupported|not supported|no recipe|introuvable|aucune recette/.test(message))
    return t("import.error.unsupported");
  if (/json|parse|syntax/.test(message)) return t("import.error.parse");
  return t("import.error.unknown");
}
