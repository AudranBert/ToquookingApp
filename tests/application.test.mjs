import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClient } from "./helpers/bundle.mjs";

test("quantities, shopping contributions, backup collisions and imported drafts", async (t) => {
  const client = await loadClient(
    t,
    `
    export * from './src/utils/quantities';
    export * from './src/utils/shoppingList';
    export * from './src/utils/backup';
    export * from './src/import/background';
  `
  );
  const { parseQuantity, buildShoppingList, parseBackupFile } = client;
  for (const [text, value] of [
    ["½", 0.5],
    ["¼", 0.25],
    ["¾", 0.75],
    ["1½", 1.5],
    ["1 1/2", 1.5],
    [".5", 0.5],
    ["0", 0],
    ["1,25", 1.25],
  ]) {
    assert.equal(parseQuantity(text), value, text);
  }
  for (const text of ["2 à 3", "1/0", "au goût", "", "200 g", "-1"])
    assert.equal(parseQuantity(text), undefined, text);

  const recipe = {
    id: "same-id",
    name: "Soupe",
    tags: [],
    instructions: ["Cuire."],
    ingredients: [{ id: "i1", name: "Tomates", quantity: "2" }],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-11-22T00:00:00Z",
  };
  const second = { ...recipe, id: "second" };
  const [tomatoes] = buildShoppingList([recipe, second]);
  assert.equal(tomatoes.label, "4 Tomates");
  assert.deepEqual(tomatoes.recipeIds, [recipe.id, second.id]);
  assert.equal(recipe.ingredients[0].quantity, "2", "generation must not mutate recipes");
  const mixed = buildShoppingList([
    recipe,
    { ...second, ingredients: [{ id: "i2", name: "Tomates", quantity: "200", unit: "g" }] },
  ]);
  assert.equal(mixed[0].label, "2 Tomates + 200 g Tomates");
  const fractions = buildShoppingList(
    [recipe, second].map((r) => ({
      ...r,
      ingredients: [{ id: "i", name: "Tomates", quantity: "½" }],
    }))
  );
  assert.equal(fractions[0].label, "1 Tomates");

  const incoming = { ...recipe, name: "Ancienne version" };
  const backup = {
    name: "backup.json",
    text: async () => JSON.stringify({ version: 1, recipes: [incoming, incoming] }),
  };
  const imported = await parseBackupFile(backup, [recipe]);
  assert(imported.recipes.every((r) => r.id !== recipe.id));
  assert.equal(new Set(imported.recipes.map((r) => r.id)).size, 2);
  assert.equal(recipe.name, "Soupe");

  const pending = client.createPendingImport("https://example.com/soupe");
  const completed = client.completePendingImport(
    pending,
    { name: "Soupe", ingredients: recipe.ingredients, instructions: recipe.instructions },
    []
  );
  assert.equal(completed.importStatus, undefined);
  assert(!completed.tags.some((tag) => /brouillon|draft/i.test(tag)));
  const edited = client.completePendingImport(
    { ...pending, name: "Mon titre", ingredients: recipe.ingredients },
    { name: "Autre", ingredients: [] },
    []
  );
  assert.equal(edited.name, "Mon titre");
  assert.deepEqual(edited.ingredients, recipe.ingredients);
});

test("ZIP export/import preserves every gallery image", async (t) => {
  const { shareRecipesBackup, parseBackupFile } = await loadClient(
    t,
    "export * from './src/utils/backup';"
  );
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let file;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      share: async ({ files }) => {
        [file] = files;
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  });
  const images = [
    "data:image/png;base64,YQ==",
    "data:image/png;base64,Yg==",
    "data:image/png;base64,Yw==",
  ];
  const recipe = {
    id: "gallery",
    name: "Photos",
    tags: [],
    ingredients: [],
    instructions: [],
    imageUrl: images[0],
    imageUrls: images,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(await shareRecipesBackup([recipe]), "shared");
  const parsed = await parseBackupFile(file, []);
  assert.deepEqual(parsed.recipes[0].imageUrls, images);
});

test("form exposes saving state on both submit buttons", async (t) => {
  const { renderForm } = await loadClient(
    t,
    `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { RecipeForm } from './src/screens/RecipeForm';
    import { createEmptyDraft } from './src/utils/recipes';
    const noop = () => {};
    export function renderForm(saving) {
      return renderToStaticMarkup(createElement(RecipeForm, {
        draft: createEmptyDraft(), importing: false, saving, editing: false, warnings: [],
        allTags: [], categories: [], tagColorByName: new Map(), importUrl: '', importText: '',
        onCreateTag: noop, onImportUrlChange: noop, onImport: noop, onImportTextChange: noop,
        onImportText: noop, onImportFile: noop, onReimport: noop, onSubmit: noop,
        onCancel: noop, setDraft: noop, onStatus: noop,
      }));
    }
  `
  );
  const saving = renderForm(true);
  const submitButtons = saving.match(/<button[^>]*type="submit"[^>]*>/g);
  assert.equal(submitButtons.length, 2);
  assert(submitButtons.every((button) => button.includes('disabled=""')));
  assert(saving.includes('aria-busy="true"'));
  assert(
    renderForm(false)
      .match(/<button[^>]*type="submit"[^>]*>/g)
      .every((button) => !button.includes("disabled"))
  );
});
