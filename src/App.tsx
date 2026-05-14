import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { db } from "./db";
import { exportElementAsPdf, exportElementAsPng, recipeFileName } from "./exporters";
import { importRecipeFromUrl } from "./importer";
import { currentSeasonalIngredients, recipeContainsSeasonalIngredient } from "./seasonal";
import { AppHeader, type Panel } from "./components/AppHeader";
import { BackupScreen } from "./screens/BackupScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { RecipeForm } from "./screens/RecipeForm";
import { ShoppingScreen } from "./screens/ShoppingScreen";
import { downloadRecipesBackup, parseBackupFile } from "./utils/backup";
import {
  buildShoppingList,
  cleanRecipeDraft,
  createEmptyDraft,
  nowIso,
  recipeMatchesQuery,
  recipeToDraft,
} from "./utils/recipes";
import type { Recipe, RecipeDraft, ShoppingItem } from "./types";
import { createId } from "./utils/id";

type ReimportMode = "replace" | "fill-blanks";

export function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft>(createEmptyDraft);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [seasonalOnly, setSeasonalOnly] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [shoppingIds, setShoppingIds] = useState<string[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>("library");
  const [status, setStatus] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshRecipes();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0];
  const seasonalIngredients = currentSeasonalIngredients();

  const allTags = useMemo(
    () => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b, "fr")),
    [recipes],
  );

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const tagMatches = !tagFilter || recipe.tags.includes(tagFilter);
        const seasonMatches =
          !seasonalOnly ||
          recipeContainsSeasonalIngredient(
            recipe.ingredients.map((ingredient) => ingredient.name),
            seasonalIngredients,
          );

        return recipeMatchesQuery(recipe, query) && tagMatches && seasonMatches;
      }),
    [recipes, query, tagFilter, seasonalIngredients, seasonalOnly],
  );

  const selectedShoppingRecipes = recipes.filter((recipe) => shoppingIds.includes(recipe.id));

  async function refreshRecipes(nextSelectedId?: string) {
    const next = await db.recipes.orderBy("updatedAt").reverse().toArray();
    setRecipes(next);
    if (nextSelectedId) setSelectedId(nextSelectedId);
  }

  function startNewRecipe() {
    setEditingId(null);
    setDraft(createEmptyDraft());
    setImportWarnings([]);
    setActivePanel("form");
  }

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setDraft(recipeToDraft(recipe));
    setImportWarnings([]);
    setActivePanel("form");
  }

  async function saveRecipe(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = cleanRecipeDraft(draft);
    if (!cleaned.name) {
      setStatus("Ajoute au minimum un nom.");
      return;
    }

    const existing = editingId ? await db.recipes.get(editingId) : undefined;
    const recipe: Recipe = {
      ...cleaned,
      id: editingId ?? createId(),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    await db.recipes.put(recipe);
    await refreshRecipes(recipe.id);
    setSelectedId(recipe.id);
    setActivePanel("library");
    setStatus(editingId ? "Recette mise à jour." : "Recette enregistrée.");
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!window.confirm(`Supprimer "${recipe.name}" ?`)) return;
    await db.recipes.delete(recipe.id);
    await refreshRecipes();
    setSelectedId(null);
    setStatus("Recette supprimée.");
  }

  async function duplicateRecipe(recipe: Recipe) {
    const copy: Recipe = {
      ...recipe,
      id: createId(),
      name: `${recipe.name} (copie)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.recipes.put(copy);
    await refreshRecipes(copy.id);
    setStatus("Recette dupliquée.");
  }

  async function handleAssistedImport() {
    if (!importUrl.trim()) return;
    setStatus("Import en cours...");

    try {
      const parsed = await importRecipeFromUrl(importUrl.trim());
      setDraft(importedRecipeToDraft(parsed, importUrl.trim()));
      setEditingId(null);
      setImportWarnings(parsed.warnings ?? []);
      setActivePanel("form");
      setStatus("Import préparé. Vérifie les champs avant d'enregistrer.");
    } catch {
      setStatus("Import impossible pour ce lien. Tu peux quand même remplir la recette manuellement.");
    }
  }

  async function reimportDraft(mode: ReimportMode) {
    const url = draft.sourceUrl?.trim();
    if (!url) {
      setStatus("Ajoute un lien source avant de réimporter.");
      return;
    }

    setStatus("Réimport en cours...");

    try {
      const parsed = await importRecipeFromUrl(url);
      const imported = importedRecipeToDraft(parsed, url);
      setDraft((current) => (mode === "replace" ? imported : mergeDraftBlanks(current, imported)));
      setImportWarnings(parsed.warnings ?? []);
      setStatus(mode === "replace" ? "Champs remplacés depuis le lien." : "Champs vides complétés depuis le lien.");
    } catch {
      setStatus("Réimport impossible pour ce lien.");
    }
  }

  async function importBackup(file: File) {
    try {
      const imported = await parseBackupFile(file, await db.recipes.toArray());
      await db.recipes.bulkPut(imported);
      await refreshRecipes(imported[0]?.id);
      setStatus(`${imported.length} recette(s) importée(s).`);
    } catch {
      setStatus("Le fichier de sauvegarde n'est pas lisible.");
    }
  }

  function regenerateShoppingList() {
    setShoppingItems(buildShoppingList(selectedShoppingRecipes));
    setStatus("Liste de courses générée.");
  }

  async function exportSelected(format: "pdf" | "png") {
    if (!selectedRecipe || !printRef.current) return;

    if (format === "pdf") {
      await exportElementAsPdf(printRef.current, recipeFileName(selectedRecipe, "pdf"));
      return;
    }

    await exportElementAsPng(printRef.current, recipeFileName(selectedRecipe, "png"));
  }

  return (
    <main className="app-shell">
      <AppHeader activePanel={activePanel} onPanelChange={setActivePanel} />

      {status && (
        <div className="notice" role="status">
          {status}
          <button className="button button--icon" onClick={() => setStatus("")} aria-label="Fermer le message">
            <X size={16} />
          </button>
        </div>
      )}

      {activePanel === "library" && (
        <LibraryScreen
          allTags={allTags}
          filteredRecipes={filteredRecipes}
          importUrl={importUrl}
          query={query}
          selectedRecipe={selectedRecipe}
          seasonalOnly={seasonalOnly}
          tagFilter={tagFilter}
          printRef={printRef}
          onDelete={deleteRecipe}
          onDuplicate={duplicateRecipe}
          onEdit={startEdit}
          onExport={exportSelected}
          onImport={handleAssistedImport}
          onImportUrlChange={setImportUrl}
          onNewRecipe={startNewRecipe}
          onQueryChange={setQuery}
          onSeasonalOnlyChange={setSeasonalOnly}
          onSelectRecipe={setSelectedId}
          onTagFilterChange={setTagFilter}
        />
      )}

      {activePanel === "form" && (
        <RecipeForm
          draft={draft}
          editing={Boolean(editingId)}
          warnings={importWarnings}
          onCancel={() => setActivePanel("library")}
          onReimport={reimportDraft}
          onSubmit={saveRecipe}
          setDraft={setDraft}
        />
      )}

      {activePanel === "shopping" && (
        <ShoppingScreen
          recipes={recipes}
          selectedRecipeIds={shoppingIds}
          items={shoppingItems}
          onAddItem={() =>
            setShoppingItems((items) => [
              ...items,
              { id: createId(), label: "Nouvel ingrédient", checked: false, recipeIds: [] },
            ])
          }
          onGenerate={regenerateShoppingList}
          onItemChange={setShoppingItems}
          onSelectionChange={setShoppingIds}
        />
      )}

      {activePanel === "backup" && (
        <BackupScreen
          onExport={() => downloadRecipesBackup(recipes)}
          onImport={importBackup}
        />
      )}
    </main>
  );
}

function importedRecipeToDraft(parsed: Partial<RecipeDraft> & { warnings?: string[] }, fallbackUrl: string): RecipeDraft {
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

function mergeDraftBlanks(current: RecipeDraft, imported: RecipeDraft): RecipeDraft {
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
