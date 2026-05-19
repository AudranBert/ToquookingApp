import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { recipeFileName, shareElementAsPdf, shareElementAsPng } from "./exporters";
import { db } from "./db";
import { MONTH_NAMES } from "./seasonal";
import { AppHeader } from "./components/AppHeader";
import { BackupScreen } from "./screens/BackupScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { RecipeForm } from "./screens/RecipeForm";
import { ShoppingScreen } from "./screens/ShoppingScreen";
import { shareRecipesBackup, shareSingleRecipeBackup } from "./utils/backup";
import {
  clearRecipeShareFromLocation,
  createRecipeShareUrl,
  readRecipeShareFromLocation,
  shareRecipeText,
  sharedRecipeToImport,
} from "./utils/recipeShare";
import { useStatus } from "./hooks/useStatus";
import { useRecipes } from "./hooks/useRecipes";
import { useRecipeFilters } from "./hooks/useRecipeFilters";
import { useRecipeDraft } from "./hooks/useRecipeDraft";
import { useShoppingList } from "./hooks/useShoppingList";
import { useTags } from "./hooks/useTags";
import type { Panel, Recipe } from "./types";

export function App() {
  const status = useStatus();
  const { recipes, refresh, save, remove, duplicate, importBackup } = useRecipes(status);
  const tagApi = useTags(recipes, status, refresh);
  const filters = useRecipeFilters(recipes, tagApi.allTags);
  const draftApi = useRecipeDraft(status, tagApi.allTags);
  const shopping = useShoppingList(recipes, status);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("library");
  const [handledSharedRecipe, setHandledSharedRecipe] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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

    if (!window.confirm(`Ajouter "${sharedRecipe.name}" a ton carnet Toque ?`)) return;

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
        status.setStatus("Recette importee.");
      })
      .catch(() => status.setStatus("Impossible d'importer cette recette."));
  }, [handledSharedRecipe, refresh, status]);

  const selectedRecipe = selectedId ? recipes.find((recipe) => recipe.id === selectedId) : undefined;
  const seasonMonthName = MONTH_NAMES[new Date().getMonth()];
  const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

  async function withShareStatus(action: () => Promise<"shared" | "downloaded" | "copied" | "sms" | "manual">, fallbackError: string) {
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
    if (result === "copied") status.setStatus("Texte de la recette copie.");
    if (result === "sms") status.setStatus("Ouverture de l'app SMS.");
    if (result === "manual") status.setStatus("Texte pret a copier.");
  }

  async function exportSelectedRecipeFile() {
    if (!selectedRecipe) return;
    const result = await withShareStatus(
      () => shareSingleRecipeBackup(selectedRecipe),
      "Le partage du fichier n'a pas abouti.",
    );
    if (result === "downloaded") status.setStatus("Fichier recette telecharge. Il peut etre importe depuis Sauvegarde.");
  }

  async function exportRecipesFile() {
    const result = await withShareStatus(
      () => shareRecipesBackup(recipes, tagApi.allTags),
      "Le partage de la sauvegarde n'a pas abouti.",
    );
    if (result === "downloaded") status.setStatus("Sauvegarde telechargee. Le partage natif n'est pas disponible sur cet appareil.");
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
          <button className="button button--icon" onClick={status.clear} aria-label="Fermer le message">
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
            noHeatingOnly: filters.noHeatingOnly,
            maxTotalTime: filters.maxTotalTime,
            seasonalThreshold: filters.seasonalThreshold,
            allTags: filters.allTags,
          }}
          filterHandlers={{
            onQueryChange: filters.setQuery,
            onTagFiltersChange: filters.setTagFilters,
            onOriginFilterChange: filters.setOriginFilter,
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
        />
      )}

      {activePanel === "form" && (
        <RecipeForm
          draft={draftApi.draft}
          editing={Boolean(draftApi.editingId)}
          warnings={draftApi.importWarnings}
          allTags={tagApi.allTags}
          onCreateTag={async (name) => {
            const tag = await tagApi.createTag(name);
            if (tag) draftApi.setDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
          }}
          onRenameTag={async (oldName, newName) => {
            const tag = await tagApi.renameTag(oldName, newName);
            draftApi.setDraft((current) => ({
              ...current,
              tags: current.tags.map((currentTag) => (currentTag === oldName ? tag : currentTag)),
            }));
          }}
          onDeleteTag={async (name) => {
            if (!window.confirm(`Supprimer le tag "${name}" de toutes les recettes ?`)) return;
            await tagApi.deleteTag(name);
            draftApi.setDraft((current) => ({ ...current, tags: current.tags.filter((tag) => tag !== name) }));
          }}
          importUrl={draftApi.importUrl}
          onImportUrlChange={draftApi.setImportUrl}
          onImport={handleAssistedImport}
          onCancel={() => setActivePanel("library")}
          onReimport={draftApi.reimport}
          onSubmit={handleSubmit}
          setDraft={draftApi.setDraft}
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
        <BackupScreen
          onExport={exportRecipesFile}
          onImport={handleBackupImport}
        />
      )}
    </main>
  );
}
