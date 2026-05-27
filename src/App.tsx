import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { recipeFileName, shareElementAsPdf, shareElementAsPng } from "./exporters";
import { db } from "./db";
import { MONTH_NAMES } from "./seasonal";
import { AppHeader } from "./components/AppHeader";
import { LibraryScreen } from "./screens/LibraryScreen";
import { RecipeForm } from "./screens/RecipeForm";
import { ShoppingScreen } from "./screens/ShoppingScreen";
import { downloadRecipeDatabaseJson, downloadRecipeImportExample, shareRecipesBackup, shareSingleRecipeBackup } from "./utils/backup";
import {
  clearRecipeShareFromLocation,
  createRecipeShareUrl,
  readRecipeShareFromLocation,
  shareRecipeLink,
  shareRecipeText,
  sharedRecipeToImport,
} from "./utils/recipeShare";
import { useStatus } from "./hooks/useStatus";
import { useRecipes } from "./hooks/useRecipes";
import { useRecipeFilters } from "./hooks/useRecipeFilters";
import { useRecipeDraft } from "./hooks/useRecipeDraft";
import { useShoppingList } from "./hooks/useShoppingList";
import { useTags } from "./hooks/useTags";
import { useIngredientsManagement } from "./hooks/useIngredientsManagement";
import { t } from "./i18n";
import type { Panel, Recipe } from "./types";
import { buildTagColorMap } from "./utils/tagStyle";
import { useAppDialog } from "./hooks/useAppDialog";
import { AppDialog } from "./components/AppDialog";

const BackupScreen = lazy(async () => import("./screens/BackupScreen").then((module) => ({ default: module.BackupScreen })));
const ManagementScreen = lazy(async () => import("./screens/ManagementScreen").then((module) => ({ default: module.ManagementScreen })));

export function App() {
  const status = useStatus();
  const { recipes, refresh, save, remove, duplicate, importBackup } = useRecipes(status);
  const tagApi = useTags(recipes, status, refresh);
  const ingredientApi = useIngredientsManagement(recipes, status, refresh);
  const filters = useRecipeFilters(recipes, tagApi.allTags);
  const draftApi = useRecipeDraft(status, tagApi.allTags);
  const shopping = useShoppingList(recipes, status);
  const dialog = useAppDialog();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("library");
  const [handledSharedRecipe, setHandledSharedRecipe] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const tagColorByName = useMemo(() => buildTagColorMap(tagApi.tags), [tagApi.tags]);
  const dialogState = dialog.dialogState;
  const dialogPromptValue = dialogState.kind === "prompt" ? dialogState.promptValue : undefined;

  useEffect(() => {
    status.clear();
  }, [activePanel]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (handledSharedRecipe) return;
    const sharedRecipe = readRecipeShareFromLocation();
    if (!sharedRecipe) {
      setHandledSharedRecipe(true);
      return;
    }

    setHandledSharedRecipe(true);
    clearRecipeShareFromLocation();

    void (async () => {
      const accepted = await dialog.confirm(t("app.confirm.importShared", { name: sharedRecipe.name }));
      if (!accepted) return;

      db.recipes
        .toArray()
        .then((existingRecipes) => {
          const importedRecipe = sharedRecipeToImport(sharedRecipe, existingRecipes);
          return db.recipes.put(importedRecipe).then(() => importedRecipe);
        })
        .then(async (importedRecipe) => {
          await refresh();
          setSelectedId(importedRecipe.id);
          setActivePanel("library");
          status.setStatus(t("app.status.importedRecipe"));
        })
        .catch(() => status.setStatus("Impossible d'importer cette recette."));
    })();
  }, [dialog, handledSharedRecipe, refresh, status]);

  const selectedRecipe = selectedId ? recipes.find((recipe) => recipe.id === selectedId) : undefined;
  const seasonMonthName = MONTH_NAMES[new Date().getMonth()];
  const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

  async function withShareStatus(action: () => Promise<"shared" | "downloaded" | "copied" | "sms" | "manual" | "too_long">, fallbackError: string) {
    try {
      return await action();
    } catch (error) {
      if (isAbortError(error)) return undefined;
      status.setStatus(fallbackError);
      return undefined;
    }
  }

  function startNewRecipe() {
    draftApi.startNew();
    setActivePanel("form");
  }

  function showRecipesList() {
    setSelectedId(null);
    setActivePanel("library");
  }

  function startEdit(recipe: Recipe) {
    draftApi.startEdit(recipe);
    setActivePanel("form");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await save(draftApi.draft, draftApi.editingId);
    if (!saved) return;
    setSelectedId(null);
    setActivePanel("library");
  }

  async function handleDelete(recipe: Recipe) {
    const accepted = await dialog.confirm(`Supprimer "${recipe.name}" ?`, undefined, true);
    if (!accepted) return;
    if (await remove(recipe)) setSelectedId(null);
  }

  async function handleDuplicate(recipe: Recipe) {
    const copy = await duplicate(recipe);
    setSelectedId(copy.id);
  }

  async function handleAssistedImport() {
    const ok = await draftApi.importFromUrl();
    if (ok) setActivePanel("form");
  }

  function handleTextImport() {
    const ok = draftApi.importFromText();
    if (ok) setActivePanel("form");
  }

  async function handleBackupImport(file: File) {
    const firstId = await importBackup(file);
    if (firstId) setSelectedId(firstId);
  }

  async function exportSelectedPdf() {
    if (!selectedRecipe || !printRef.current) return;
    const result = await withShareStatus(
      () => shareElementAsPdf(printRef.current!, recipeFileName(selectedRecipe, "pdf"), selectedRecipe.name),
      "Le partage PDF n'a pas abouti.",
    );
    if (result === "downloaded") status.setStatus("PDF telecharge. Le partage natif n'est pas disponible sur cet appareil.");
  }

  async function shareSelectedImage() {
    if (!selectedRecipe || !printRef.current) return;
    const target = printRef.current;
    const shareUrl = createRecipeShareUrl(selectedRecipe);

    const result = await withShareStatus(
      () =>
        shareElementAsPng(target, recipeFileName(selectedRecipe, "png"), selectedRecipe.name, `Recette Toque: ${selectedRecipe.name}\n${shareUrl}`),
      "Le partage n'a pas abouti.",
    );
    if (result === "downloaded") status.setStatus("PNG telecharge. Le partage natif n'est pas disponible sur cet appareil.");
  }

  async function shareSelectedText() {
    if (!selectedRecipe) return;

    const result = await withShareStatus(() => shareRecipeText(selectedRecipe), "Le partage texte n'a pas abouti.");
    if (result === "downloaded") status.setStatus("Texte trop long pour SMS. Fichier .txt telecharge.");
    if (result === "copied") status.setStatus("Texte de la recette copie.");
    if (result === "sms") status.setStatus("Ouverture de l'app SMS.");
    if (result === "manual") status.setStatus("Texte pret a copier.");
  }

  async function exportSelectedRecipeFile() {
    if (!selectedRecipe) return;
    let result = await withShareStatus(
      () => shareRecipeLink(selectedRecipe),
      "Le partage du lien n'a pas abouti.",
    );
    if (result === "too_long") {
      result = await withShareStatus(
        () => shareSingleRecipeBackup(selectedRecipe),
        "Le partage du fichier recette n'a pas abouti.",
      );
      if (result === "downloaded") status.setStatus("Lien trop long. Fichier recette .json telecharge.");
      if (result === "shared") status.setStatus("Lien trop long. Fichier recette .json partage.");
      return;
    }
    if (result === "shared") status.setStatus("Lien recette partage.");
    if (result === "copied") status.setStatus("Lien recette copie.");
    if (result === "manual") status.setStatus("Lien recette pret a copier.");
  }

  async function exportRecipesFile() {
    const result = await withShareStatus(
      () => shareRecipesBackup(recipes, tagApi.tags),
      "Le partage de la sauvegarde n'a pas abouti.",
    );
    if (result === "downloaded") status.setStatus("Sauvegarde telechargee. Le partage natif n'est pas disponible sur cet appareil.");
  }

  function downloadImportExampleFile() {
    downloadRecipeImportExample();
    status.setStatus("Exemple JSON telecharge.");
  }

  function downloadDatabaseJsonFile() {
    downloadRecipeDatabaseJson(recipes, tagApi.tags);
    status.setStatus("Base JSON telechargee.");
  }

  return (
    <main className="app-shell">
      <AppHeader
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onShowRecipes={showRecipesList}
        onNewRecipe={startNewRecipe}
      />

      {status.status && (
        <div className="notice" role="status">
          {status.status}
          <button className="button button--icon" onClick={status.clear} aria-label={t("app.status.close")}>
            <X size={16} />
          </button>
        </div>
      )}

      {activePanel === "library" && (
        <LibraryScreen
          filters={{
            query: filters.query,
            tagFilters: filters.tagFilters,
            originFilter: filters.originFilter,
            regimeFilter: filters.regimeFilter,
            noHeatingOnly: filters.noHeatingOnly,
            maxTotalTime: filters.maxTotalTime,
            seasonalThreshold: filters.seasonalThreshold,
            allTags: filters.allTags,
            tagColorByName,
            tagCategories: tagApi.categories,
          }}
          filterHandlers={{
            onQueryChange: filters.setQuery,
            onTagFiltersChange: filters.setTagFilters,
            onOriginFilterChange: filters.setOriginFilter,
            onRegimeFilterChange: filters.setRegimeFilter,
            onNoHeatingOnlyChange: filters.setNoHeatingOnly,
            onMaxTotalTimeChange: filters.setMaxTotalTime,
            onSeasonalThresholdChange: filters.setSeasonalThreshold,
          }}
          actions={{
            onEdit: startEdit,
            onDelete: handleDelete,
            onDuplicate: handleDuplicate,
            onExportPdf: exportSelectedPdf,
            onShareImage: shareSelectedImage,
            onShareText: shareSelectedText,
            onExportRecipeFile: exportSelectedRecipeFile,
            onSelectRecipe: setSelectedId,
            onShowList: () => setSelectedId(null),
          }}
          filteredRecipes={filters.filteredRecipes}
          selectedRecipe={selectedRecipe}
          seasonalMatchCounts={filters.seasonalMatchCounts}
          seasonalRecipeIds={filters.seasonalRecipeIds}
          seasonMonthName={seasonMonthName}
          printRef={printRef}
          tagColorByName={tagColorByName}
        />
      )}

      {activePanel === "form" && (
        <RecipeForm
          draft={draftApi.draft}
          editing={Boolean(draftApi.editingId)}
          warnings={draftApi.importWarnings}
          allTags={tagApi.allTags}
          categories={tagApi.categories}
          tagColorByName={tagColorByName}
          onCreateTag={async (name) => {
            const tag = await tagApi.createTag(name);
            if (tag) draftApi.setDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
            return tag;
          }}
          importUrl={draftApi.importUrl}
          onImportUrlChange={draftApi.setImportUrl}
          onImport={handleAssistedImport}
          importText={draftApi.importText}
          onImportTextChange={draftApi.setImportText}
          onImportText={handleTextImport}
          onCancel={() => setActivePanel("library")}
          onReimport={draftApi.reimport}
          onSubmit={handleSubmit}
          setDraft={draftApi.setDraft}
          onStatus={status.setStatus}
        />
      )}

      {activePanel === "shopping" && (
        <ShoppingScreen
          recipes={recipes}
          selectedRecipeIds={shopping.selectedIds}
          items={shopping.items}
          onAddItem={shopping.addItem}
          onGenerate={shopping.regenerate}
          onItemChange={shopping.setItems}
          onSelectionChange={shopping.setSelectedIds}
          onStatus={status.setStatus}
        />
      )}

      {activePanel === "backup" && (
        <Suspense fallback={<section className="panel workspace"><p>Chargement...</p></section>}>
          <BackupScreen
            onExport={exportRecipesFile}
            onImport={handleBackupImport}
            onDownloadExample={downloadImportExampleFile}
            onDownloadDatabase={downloadDatabaseJsonFile}
          />
        </Suspense>
      )}

      {activePanel === "management" && (
        <Suspense fallback={<section className="panel workspace"><p>Chargement...</p></section>}>
          <ManagementScreen
            tags={tagApi.tags}
            categories={tagApi.categories}
            protectedTags={tagApi.protectedTags}
            onCreateTag={tagApi.createTag}
            onRenameTag={tagApi.renameTag}
            onMergeTags={tagApi.mergeTags}
            onDeleteTag={tagApi.deleteTag}
            onUpdateTagMeta={tagApi.updateTagMeta}
            ingredients={ingredientApi.allIngredients}
            onRenameIngredient={ingredientApi.renameIngredient}
            onMergeIngredients={ingredientApi.mergeIngredients}
            onDeleteIngredient={ingredientApi.deleteIngredient}
            onConfirm={dialog.confirm}
            onPrompt={dialog.prompt}
          />
        </Suspense>
      )}

      <AppDialog
        open={dialogState.open}
        title={dialogState.title}
        message={"message" in dialogState ? dialogState.message : undefined}
        promptValue={dialogPromptValue}
        danger={"danger" in dialogState ? dialogState.danger : undefined}
        confirmLabel={"confirmLabel" in dialogState ? dialogState.confirmLabel : undefined}
        cancelLabel={"cancelLabel" in dialogState ? dialogState.cancelLabel : undefined}
        onPromptValueChange={dialog.setPromptValue}
        onCancel={() => dialog.closeWith(null)}
        onConfirm={() => dialog.closeWith(typeof dialogPromptValue === "string" ? dialogPromptValue : true)}
      />
    </main>
  );
}
