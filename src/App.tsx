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
import { downloadRecipeDatabaseJson, downloadRecipeImportExample, parseBackupFile, shareRecipesBackup, summarizeBackupImport } from "./utils/backup";
import {
  copyRecipeShareLink,
  shareRecipeText,
  sharedRecipeToImport,
} from "./utils/recipeSharing";
import { clearRecipeShareFromLocation, readRecipeShareFromLocation } from "./utils/legacyRecipeLink";
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
import { putRecipe } from "./data/recipeRepository";
import { useCloudBackup } from "./hooks/useCloudBackup";
import { createCloudShare, readCloudShareFromLocation } from "./cloud/sharing";
import { AppDialog } from "./components/AppDialog";
import { importRecipeFromUrl } from "./importer";
import {
  completePendingImport,
  createPendingImport,
  failPendingImport,
  hasImportedContent,
} from "./import/background";

const BackupScreen = lazy(async () => import("./screens/BackupScreen").then((module) => ({ default: module.BackupScreen })));
const ManagementScreen = lazy(async () => import("./screens/ManagementScreen").then((module) => ({ default: module.ManagementScreen })));

function isZipFile(file: File) {
  return file.name.toLowerCase().endsWith(".zip");
}

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
  const cloud = useCloudBackup(refresh, status.setStatus, activePanel === "backup");
  const activeImports = useRef(new Set<string>());
  const handledSharedRecipe = useRef(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const tagColorByName = useMemo(() => buildTagColorMap(tagApi.tags), [tagApi.tags]);
  const dialogState = dialog.dialogState;
  const dialogPromptValue = dialogState.kind === "prompt" ? dialogState.promptValue : undefined;
  const dialogPromptSuggestions = dialogState.kind === "prompt" ? dialogState.suggestions : undefined;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    for (const recipe of recipes) {
      if (recipe.importStatus !== "pending" || activeImports.current.has(recipe.id)) continue;
      activeImports.current.add(recipe.id);
      void runBackgroundImport(recipe.id, recipe.sourceUrl ?? "");
    }
  }, [recipes]);

  useEffect(() => {
    if (handledSharedRecipe.current) return;
    handledSharedRecipe.current = true;
    void (async () => {
      try {
        const sharedRecipe = readRecipeShareFromLocation() ?? await readCloudShareFromLocation();
        if (!sharedRecipe) return;
        const accepted = await dialog.confirm(t("app.confirm.importShared", { name: sharedRecipe.name }));
        if (!accepted) return;
        const importedRecipe = sharedRecipeToImport(sharedRecipe, await db.recipes.toArray());
        await putRecipe(importedRecipe);
        clearRecipeShareFromLocation();
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        await refresh();
        setSelectedId(importedRecipe.id);
        setActivePanel("library");
        status.setStatus(t("app.status.importedRecipe"));
      } catch {
        status.setStatus(t("cloud.shareLoadFailed"));
      }
    })();
  }, [dialog, refresh, status]);

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
    status.clear();
    setActivePanel("form");
  }

  function showRecipesList() {
    status.clear();
    setSelectedId(null);
    setActivePanel("library");
  }

  async function startEdit(recipe: Recipe) {
    if (draftApi.hasChanges && !await dialog.confirm(t("recipe.form.discardTitle"), t("recipe.form.discardBody"))) return;
    draftApi.startEdit(recipe);
    setActivePanel("form");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await save(draftApi.draft, draftApi.editingId);
    if (!saved) return;
    draftApi.startNew();
    setSelectedId(null);
    setActivePanel("library");
  }

  async function handleDelete(recipe: Recipe) {
    const accepted = await dialog.confirm(t("recipe.confirm.delete", { name: recipe.name }), undefined, true);
    if (!accepted) return;
    if (await remove(recipe)) setSelectedId(null);
  }

  async function handleDuplicate(recipe: Recipe) {
    const copy = await duplicate(recipe);
    setSelectedId(copy.id);
  }

  async function handleAssistedImport() {
    const url = draftApi.importUrl.trim();
    if (!url) return;
    const pending = createPendingImport(url);
    try {
      activeImports.current.add(pending.id);
      await db.recipes.put(pending);
      await refresh();
      draftApi.startNew();
      setSelectedId(null);
      setActivePanel("library");
      status.setStatus(t("import.background.started", { name: pending.name }));
      void runBackgroundImport(pending.id, url);
    } catch {
      activeImports.current.delete(pending.id);
      status.setStatus(t("import.background.createFailed"));
    }
  }

  async function runBackgroundImport(recipeId: string, url: string) {
    try {
      const parsed = await importRecipeFromUrl(url);
      const current = await db.recipes.get(recipeId);
      if (!current) return;
      if (!hasImportedContent(parsed)) {
        const reason = parsed.warnings?.join(" ") || t("import.background.noContent");
        await db.recipes.put(failPendingImport(current, reason));
        await refresh();
        showImportFailure(recipeId, current.name);
        return;
      }
      const completed = completePendingImport(current, parsed, tagApi.allTags);
      await putRecipe(completed);
      await refresh();
      status.setStatus(
        t("import.background.completed", { name: completed.name }),
        () => {
          setSelectedId(completed.id);
          setActivePanel("library");
          status.clear();
        },
        8_000,
      );
    } catch (error) {
      const current = await db.recipes.get(recipeId);
      if (!current) return;
      const message = error instanceof Error ? error.message : t("import.background.noContent");
      await db.recipes.put(failPendingImport(current, message));
      await refresh();
      showImportFailure(recipeId, current.name);
    }
  }

  function showImportFailure(recipeId: string, name: string) {
    status.setStatus(
      t("import.background.failed", { name }),
      () => {
        void db.recipes.get(recipeId).then((recipe) => {
          if (!recipe) return;
          draftApi.startEdit(recipe);
          setActivePanel("form");
          status.clear();
        });
      },
      8_000,
    );
  }

  function handleTextImport() {
    const ok = draftApi.importFromText();
    if (ok) setActivePanel("form");
  }

  async function handleRecipeFileImport(file: File) {
    try {
      if (!isZipFile(file)) {
        const ok = draftApi.importFromRawText(await file.text());
        if (!ok) {
          status.setStatus(t("import.status.fileTextUnreadable"));
          return;
        }
        setActivePanel("form");
        return;
      }

      const imported = await parseBackupFile(file, []);
      if (imported.recipes.length === 0) {
        status.setStatus(t("import.status.fileNoRecipe"));
        return;
      }
      if (imported.recipes.length > 1) {
        status.setStatus(t("import.status.fileMultipleRecipes"));
        return;
      }
      draftApi.importFromRecipe(imported.recipes[0]);
      setActivePanel("form");
    } catch {
      status.setStatus(t("import.status.fileUnreadable"));
    }
  }

  async function handleBackupImport(file: File) {
    try {
      const summary = await summarizeBackupImport(file, recipes);
      const duplicateSummary = summary.duplicateNames.length > 0
        ? summary.duplicateNames.slice(0, 6).join(", ")
        : t("backup.importSummary.duplicates.none");
      const overflow = summary.duplicateNames.length > 6
        ? `\n${t("backup.importSummary.duplicates.more", { count: summary.duplicateNames.length - 6 })}`
        : "";
      const accepted = await dialog.confirm(
        t("backup.importSummary.title"),
        [
          t("backup.importSummary.recipes", { count: summary.recipeCount }),
          t("backup.importSummary.images", { count: summary.imageCount }),
          t("backup.importSummary.duplicates", { names: duplicateSummary }),
          overflow,
        ].filter(Boolean).join("\n"),
        false,
        t("backup.action.import"),
      );
      if (!accepted) return;
    } catch {
      status.setStatus(t("import.status.fileUnreadable"));
      return;
    }

    const firstId = await importBackup(file);
    if (firstId) setSelectedId(firstId);
  }

  async function exportSelectedPdf() {
    if (!selectedRecipe || !printRef.current) return;
    const result = await withShareStatus(
      () => shareElementAsPdf(printRef.current!, recipeFileName(selectedRecipe, "pdf"), selectedRecipe.name),
      t("share.error.pdf"),
    );
    if (result === "downloaded") status.setStatus(t("share.status.pdfDownloaded"));
  }

  async function shareSelectedImage() {
    if (!selectedRecipe || !printRef.current) return;
    const target = printRef.current;

    const result = await withShareStatus(
      () =>
        shareElementAsPng(target, recipeFileName(selectedRecipe, "png"), selectedRecipe.name, t("share.text.recipeTitle", { name: selectedRecipe.name })),
      t("share.error.generic"),
    );
    if (result === "downloaded") status.setStatus(t("share.status.pngDownloaded"));
  }

  async function shareSelectedText() {
    if (!selectedRecipe) return;

    const result = await withShareStatus(() => shareRecipeText(selectedRecipe), t("share.error.text"));
    if (result === "downloaded") status.setStatus(t("share.status.txtDownloaded"));
    if (result === "copied") status.setStatus(t("share.status.recipeTextCopied"));
    if (result === "sms") status.setStatus(t("share.status.smsOpen"));
  }

  async function shareSelectedRecipeLink() {
    if (!selectedRecipe || creatingShare) return;
    setCreatingShare(true);
    status.setStatus(t("cloud.creatingShare"));
    try {
      const url = await createCloudShare(selectedRecipe);
      setShareLink(url);
      status.clear();
    } catch (error) {
      if (!isAbortError(error)) status.setStatus(t("cloud.shareFailed"));
    } finally {
      setCreatingShare(false);
    }
  }

  async function exportRecipesFile() {
    const result = await withShareStatus(
      () => shareRecipesBackup(recipes, tagApi.tags),
      t("backup.status.shareFailed"),
    );
    if (result === "downloaded") status.setStatus(t("backup.status.downloadedNoNativeShare"));
  }

  function downloadImportExampleFile() {
    downloadRecipeImportExample();
    status.setStatus(t("backup.status.exampleDownloaded"));
  }

  function downloadDatabaseJsonFile() {
    downloadRecipeDatabaseJson(recipes, tagApi.tags);
    status.setStatus(t("backup.status.databaseDownloaded"));
  }

  return (
    <main className="app-shell">
      <AppHeader
        activePanel={activePanel}
        onPanelChange={(panel) => { status.clear(); setActivePanel(panel); }}
        onShowRecipes={showRecipesList}
        onNewRecipe={startNewRecipe}
      />

      {status.status && (
        <div className={`notice${status.onActivate ? " notice--action" : ""}`} role="status">
          {status.onActivate ? (
            <button className="notice__content" type="button" onClick={status.onActivate}>
              {status.status}
            </button>
          ) : <span>{status.status}</span>}
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
            excludedTagFilters: filters.excludedTagFilters,
            filterPresets: filters.filterPresets,
            activePresetId: filters.activePresetId,
          }}
          filterHandlers={{
            onQueryChange: filters.setQuery,
            onTagFiltersChange: filters.setTagFilters,
            onOriginFilterChange: filters.setOriginFilter,
            onRegimeFilterChange: filters.setRegimeFilter,
            onNoHeatingOnlyChange: filters.setNoHeatingOnly,
            onMaxTotalTimeChange: filters.setMaxTotalTime,
            onSeasonalThresholdChange: filters.setSeasonalThreshold,
            onApplyPreset: filters.applyPreset,
            onClearFilters: filters.clearFilters,
          }}
          actions={{
            onEdit: startEdit,
            onDelete: handleDelete,
            onDuplicate: handleDuplicate,
            onExportPdf: exportSelectedPdf,
            onShareImage: shareSelectedImage,
            onShareText: shareSelectedText,
            onShareLink: shareSelectedRecipeLink,
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
          importing={draftApi.isImporting}
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
          onImportFile={handleRecipeFileImport}
          onCancel={async () => {
            if (draftApi.hasChanges && !await dialog.confirm(t("recipe.form.discardTitle"), t("recipe.form.discardBody"))) return;
            draftApi.startNew();
            status.clear();
            setActivePanel("library");
          }}
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
        <Suspense fallback={<section className="panel workspace"><p>{t("app.loading")}</p></section>}>
          <BackupScreen
            cloud={cloud}
            onConfirm={dialog.confirm}
            onExport={exportRecipesFile}
            onImport={handleBackupImport}
            onDownloadExample={downloadImportExampleFile}
            onDownloadDatabase={downloadDatabaseJsonFile}
            onStatus={status.setStatus}
          />
        </Suspense>
      )}

      {activePanel === "management" && (
        <Suspense fallback={<section className="panel workspace"><p>{t("app.loading")}</p></section>}>
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

      {shareLink && <AppDialog
        open
        title={t("cloud.shareReady")}
        message={t("cloud.shareHelp")}
        promptValue={shareLink}
        promptReadOnly
        confirmLabel={t("cloud.copyLink")}
        cancelLabel={t("cloud.close")}
        onCancel={() => setShareLink(null)}
        onConfirm={() => {
          void copyRecipeShareLink(shareLink).then((result) => {
            status.setStatus(t(result === "copied" ? "share.status.linkCopied" : "cloud.copyManually"));
            if (result === "copied") setShareLink(null);
          });
        }}
      />}

      <AppDialog
        open={dialogState.open}
        title={dialogState.title}
        message={"message" in dialogState ? dialogState.message : undefined}
        promptValue={dialogPromptValue}
        promptSuggestions={dialogPromptSuggestions}
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
