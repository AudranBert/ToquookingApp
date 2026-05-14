import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { exportElementAsPdf, exportElementAsPng, recipeFileName } from "./exporters";
import { MONTH_NAMES } from "./seasonal";
import { AppHeader } from "./components/AppHeader";
import { BackupScreen } from "./screens/BackupScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { RecipeForm } from "./screens/RecipeForm";
import { ShoppingScreen } from "./screens/ShoppingScreen";
import { downloadRecipesBackup } from "./utils/backup";
import { useStatus } from "./hooks/useStatus";
import { useRecipes } from "./hooks/useRecipes";
import { useRecipeFilters } from "./hooks/useRecipeFilters";
import { useRecipeDraft } from "./hooks/useRecipeDraft";
import { useShoppingList } from "./hooks/useShoppingList";
import type { Panel, Recipe } from "./types";

export function App() {
  const status = useStatus();
  const { recipes, save, remove, duplicate, importBackup } = useRecipes(status);
  const filters = useRecipeFilters(recipes);
  const draftApi = useRecipeDraft(status);
  const shopping = useShoppingList(recipes, status);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("library");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const selectedRecipe = selectedId ? recipes.find((recipe) => recipe.id === selectedId) : undefined;
  const seasonMonthName = MONTH_NAMES[new Date().getMonth()];

  function startNewRecipe() {
    draftApi.startNew();
    setActivePanel("form");
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

  async function exportSelected(format: "pdf" | "png") {
    if (!selectedRecipe || !printRef.current) return;
    if (format === "pdf") {
      await exportElementAsPdf(printRef.current, recipeFileName(selectedRecipe, "pdf"));
    } else {
      await exportElementAsPng(printRef.current, recipeFileName(selectedRecipe, "png"));
    }
  }

  return (
    <main className="app-shell">
      <AppHeader activePanel={activePanel} onPanelChange={setActivePanel} />

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
            tagFilter: filters.tagFilter,
            originFilter: filters.originFilter,
            seasonalThreshold: filters.seasonalThreshold,
            allTags: filters.allTags,
          }}
          filterHandlers={{
            onQueryChange: filters.setQuery,
            onTagFilterChange: filters.setTagFilter,
            onOriginFilterChange: filters.setOriginFilter,
            onSeasonalThresholdChange: filters.setSeasonalThreshold,
          }}
          actions={{
            onEdit: startEdit,
            onDelete: handleDelete,
            onDuplicate: handleDuplicate,
            onExport: exportSelected,
            onSelectRecipe: setSelectedId,
            onShowList: () => setSelectedId(null),
            onNewRecipe: startNewRecipe,
          }}
          filteredRecipes={filters.filteredRecipes}
          selectedRecipe={selectedRecipe}
          seasonalMatchCounts={filters.seasonalMatchCounts}
          seasonalRecipeIds={filters.seasonalRecipeIds}
          seasonMonthName={seasonMonthName}
          importUrl={draftApi.importUrl}
          onImportUrlChange={draftApi.setImportUrl}
          onImport={handleAssistedImport}
          printRef={printRef}
        />
      )}

      {activePanel === "form" && (
        <RecipeForm
          draft={draftApi.draft}
          editing={Boolean(draftApi.editingId)}
          warnings={draftApi.importWarnings}
          allTags={filters.allTags}
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
        />
      )}

      {activePanel === "backup" && (
        <BackupScreen
          onExport={() => downloadRecipesBackup(recipes)}
          onImport={handleBackupImport}
        />
      )}
    </main>
  );
}
