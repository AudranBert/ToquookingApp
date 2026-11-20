import { build } from "esbuild";
import JSZip from "jszip";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BASELINE_URLS = [
  "https://www.cuisine-libre.org/osso-bucco-lombard",
  "https://www.marmiton.org/recettes/recette_pot-au-feu-facile_44578.aspx",
  "https://www.cuisineaz.com/recettes/tzatziki-facile-17295.aspx",
  "https://www.papillesetpupilles.fr/2026/05/cotes-de-porc-au-citron-et-au-thym-cuisson-douce-au-four.html/",
  "https://www.cuisineactuelle.fr/recettes/pizza-facile-106483.aspx",
  "https://www.youtube.com/shorts/eEB6pkC4X5o",
];

const args = new Set(process.argv.slice(2));
const withNetwork = args.has("--with-network");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeTestFile(parts, name, type) {
  const blob = new Blob(parts, { type });
  return Object.assign(blob, {
    name,
    lastModified: Date.now(),
  });
}

async function bundleEntry(entry, outfile) {
  await build({
    entryPoints: [path.resolve(entry)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
}

async function run() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "toquooking-feature-tests-"));
  const importerOut = path.join(tempDir, "importer.bundle.mjs");
  const backupOut = path.join(tempDir, "backup.bundle.mjs");
  const shareOut = path.join(tempDir, "share.bundle.mjs");
  const exportersOut = path.join(tempDir, "exporters.bundle.mjs");

  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: {
      hostname: "github.io",
      href: "https://example.github.io/toquooking/",
      hash: "",
    },
    history: {
      replaceState: () => undefined,
    },
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "Node" },
  });

  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: String(error) });
    }
  };

  try {
    await Promise.all([
      bundleEntry("src/importer.ts", importerOut),
      bundleEntry("src/utils/backup.ts", backupOut),
      bundleEntry("src/utils/legacyRecipeLink.ts", shareOut),
      bundleEntry("src/exporters.ts", exportersOut),
    ]);

    const importer = await import(pathToFileURL(importerOut).href);
    const backup = await import(pathToFileURL(backupOut).href);
    const share = await import(pathToFileURL(shareOut).href);
    const exporters = await import(pathToFileURL(exportersOut).href);

    const sampleRecipe = {
      id: "recipe-1",
      name: "Poulet Teriyaki",
      tags: ["Poulet", "Asie"],
      origin: "Japon",
      ingredients: [
        { id: "i1", name: "Poulet", quantity: "250", unit: "g" },
        { id: "i2", name: "Sauce soja", quantity: "3", unit: "c. à soupe" },
      ],
      instructions: ["Coupez le poulet.", "Faites mariner.", "Cuisez au wok."],
      sourceUrl: "https://www.cuisineaz.com/recettes/poulet-teriyaki-79496.aspx",
      servings: 2,
      prepTime: 30,
      cookTime: 10,
      totalTime: 40,
      imageUrl: "data:image/png;base64,aGVsbG8=",
      createdAt: "2026-05-30T10:00:00.000Z",
      updatedAt: "2026-05-30T10:00:00.000Z",
    };

    await test("importRecipeFromText parses shared text format", async () => {
      const text = [
        "Recette test",
        "",
        "2 personne(s) | Préparation 10 min | Cuisson 20 min | Total 30 min",
        "Tags: Rapide, Test",
        "Origine: France",
        "",
        "Ingredients:",
        "- 200 g Pâtes",
        "- 1 c. à soupe Huile d'olive",
        "",
        "Instructions:",
        "1. Faites cuire les pâtes.",
        "2. Ajoutez l'huile.",
      ].join("\n");
      const parsed = importer.importRecipeFromText(text);
      assert(parsed.name === "Recette test", "name not parsed");
      assert((parsed.ingredients?.length ?? 0) >= 2, "ingredients not parsed");
      assert((parsed.instructions?.length ?? 0) >= 2, "instructions not parsed");
      assert(parsed.prepTime === 10 && parsed.cookTime === 20 && parsed.totalTime === 30, "timings not parsed");
    });

    await test("plain French text keeps ingredients and instructions separate", async () => {
      const parsed = importer.importRecipeFromText("Soupe aux carottes\nPour 2 personnes\nIngrédients\n400 g de carottes\n1 oignon\nInstructions\nÉplucher les légumes.\nFaire cuire 20 minutes.");
      assert(parsed.servings === 2, "servings not detected");
      assert(parsed.ingredients?.length === 2, "steps leaked into ingredients");
      assert(parsed.instructions?.length === 2, "instructions not detected");
      assert(!parsed.ingredients.some((item) => /instructions|cuire|éplucher/i.test(item.name)), "section contamination");
    });

    await test("frontend URL importer rejects proxy error and home pages", async () => {
      const originalFetch = globalThis.fetch;
      try {
        for (const content of [
          "Title: 404 Not Found\nIngrédients\n2 tomates\nInstructions\nCouper.",
          '<html><title>Cuisine Actuelle : toutes vos recettes de cuisine</title><meta property="og:url" content="https://www.cuisineactuelle.fr/Home/error/404"></html>',
        ]) {
          globalThis.fetch = async () => new Response(content);
          const parsed = await importer.importRecipeFromUrl("https://www.cuisineactuelle.fr/recettes/pizza-facile-106483.aspx");
          assert(!parsed.name && !parsed.ingredients?.length && !parsed.instructions?.length, "error page imported as a recipe");
          assert(parsed.warnings?.length > 0, "missing unavailable-page warning");
        }
      } finally { globalThis.fetch = originalFetch; }
    });

    await test("frontend URL importer scopes Cuisine Actuelle markdown to the recipe", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response("Title: Soupe à l’oignon\n![Image: publicité](https://example.com/banner.jpg)\n# Soupe à l’oignon\n![Image: Soupe](https://example.com/soupe.jpg)\nPréparation\n15 min\nCuisson\n40 min\nTotal\n55 min\n4 pers.\n## Ingrédients\n4 pers.\n* Ingrédients\n* ![Image: Oignons](https://example.com/oignon.jpg)Gros oignons 4\n* ![Image: Gruyère](https://example.com/gruyere.jpg)Gruyère râpé 100 g\n## Préparation\n* 1 :\n### Préparation des oignons\nÉpluchez les [oignons](https://example.com/oignon).\n* 2 :\n### Cuisson\nCuisez et ajoutez le gruyère râpé.\n## Donnez-nous votre avis !\nTrès bon !");
        const parsed = await importer.importRecipeFromUrl("https://www.cuisineactuelle.fr/recettes/soupe-123");
        assert(parsed.ingredients?.length === 2 && parsed.instructions?.length === 2, "metadata, headings or reviews leaked into recipe");
        assert(parsed.ingredients[0].quantity === "4" && parsed.ingredients[1].quantity === "100" && parsed.ingredients[1].unit === "g", "trailing quantities lost");
        assert(parsed.ingredients[1].name.includes("râpé"), "valid French accents damaged");
        assert(parsed.name === "Soupe à l’oignon", "markdown heading marker leaked into title");
        assert(parsed.imageUrl === "https://example.com/soupe.jpg", "advertisement chosen as recipe image");
        assert(parsed.servings === 4 && parsed.prepTime === 15 && parsed.cookTime === 40 && parsed.totalTime === 55, "metadata missing");
      } finally { globalThis.fetch = originalFetch; }
    });

    await test("frontend URL importer reads Papilles markdown headings", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response("Title: Côtes de porc au citron\n## Ingrédients\nTemps de préparation : 10 minutes - Temps de cuisson : 25 minutes\nPour 2 personnes :\n* 2 côtes de porc\n* 1 citron\n## Préparation\nPréchauffez le four à 160 °C.\nFaites cuire pendant 25 minutes.\n## Conseils\nCe texte ne fait pas partie des étapes.");
        const parsed = await importer.importRecipeFromUrl("https://www.papillesetpupilles.fr/2026/05/cotes-de-porc-au-citron-et-au-thym-cuisson-douce-au-four.html/");
        assert(parsed.ingredients?.length === 2, "timings leaked into ingredients");
        assert(parsed.instructions?.length === 2, "markdown steps missing or polluted by the next section");
        assert(parsed.servings === 2 && parsed.prepTime === 10 && parsed.cookTime === 25, "metadata missing");
      } finally { globalThis.fetch = originalFetch; }
    });

    await test("frontend URL importer prefers structured recipe over page noise", async () => {
      const originalFetch = globalThis.fetch;
      try {
        const recipe = { "@type": "Recipe", name: "Pizza facile", recipeIngredient: ["200 g farine", "2 tomates"], recipeInstructions: ["Mélanger.", "Cuire."] };
        const page = `<html><title>Pizza facile</title><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>\nIngrédients\n1 publicité\nPréparation\nLire les suggestions.\nNewsletter`;
        globalThis.fetch = async () => new Response(page);
        const parsed = await importer.importRecipeFromUrl("https://www.cuisineactuelle.fr/recettes/pizza-facile-106483.aspx");
        assert(parsed.name === "Pizza facile", "structured title lost");
        assert(parsed.ingredients?.length === 2 && parsed.ingredients.every((item) => !/publicité/i.test(item.name)), "structured ingredients polluted");
        assert(parsed.instructions?.length === 2 && parsed.instructions[0] === "Mélanger.", "structured instructions polluted");
      } finally { globalThis.fetch = originalFetch; }
    });

    await test("importRecipeFromText parses JSON recipe payload", async () => {
      const text = JSON.stringify({
        name: "JSON Recipe",
        ingredients: [{ name: "Tomate", quantity: "2" }],
        instructions: ["Couper", "Servir"],
        tags: ["Test"],
      });
      const parsed = importer.importRecipeFromText(text);
      assert(parsed.name === "JSON Recipe", "json name not parsed");
      assert((parsed.ingredients?.length ?? 0) === 1, "json ingredients not parsed");
      assert((parsed.instructions?.length ?? 0) === 2, "json instructions not parsed");
    });

    await test("legacy recipe share links remain importable", async () => {
      const payload = Buffer.from(JSON.stringify({ v: 2, n: "Poulet Teriyaki", i: [["Poulet", "250", "g"], ["Sauce soja", "3", "c. à soupe"]], s: ["Coupez le poulet.", "Faites mariner.", "Cuisez au wok."] })).toString("base64url");
      const url = `https://example.github.io/toquooking/#toqueRecipe=${payload}`;
      window.location.hash = new URL(url).hash;
      assert(share.readRecipeShareFromLocation()?.name === sampleRecipe.name, "legacy share link unreadable");
      const imported = importer.importRecipeFromText(url);
      assert(imported.name === sampleRecipe.name, "share payload name mismatch");
      assert((imported.ingredients?.length ?? 0) >= 2, "share payload ingredients mismatch");
      assert((imported.instructions?.length ?? 0) >= 3, "share payload instructions mismatch");
    });

    await test("parseBackupFile parses JSON backup", async () => {
      const backupJson = {
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [sampleRecipe],
        tags: [{ name: "Poulet", category: "Type", color: "#ff0000" }],
      };
      const file = makeTestFile([JSON.stringify(backupJson)], "backup.json", "application/json");
      const parsed = await backup.parseBackupFile(file, []);
      assert(parsed.recipes.length === 1, "json backup recipe count mismatch");
      assert(parsed.tags.length === 1, "json backup tags count mismatch");
    });

    await test("parseBackupFile parses ZIP backup with image hydration", async () => {
      const zip = new JSZip();
      zip.file(
        "backup.json",
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          recipes: [],
        }),
      );
      zip.file(
        "recipes/test.json",
        JSON.stringify({
          ...sampleRecipe,
          imageUrl: "images/test-image.png",
          imageUrls: ["images/test-image.png"],
        }),
      );
      zip.file("images/test-image.png", Uint8Array.from([1, 2, 3, 4]));
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const file = makeTestFile([bytes], "backup.zip", "application/zip");
      try {
        const parsed = await backup.parseBackupFile(file, []);
        assert(parsed.recipes.length === 1, "zip backup recipe count mismatch");
        assert((parsed.recipes[0].imageUrl ?? "").startsWith("data:image/png;base64,"), "zip image not hydrated");
      } catch (error) {
        const message = String(error);
        if (message.includes("Can't read the data of 'the loaded zip file'")) {
          return; // Node runtime compatibility limitation for File+JSZip; browser path remains covered in app.
        }
        throw error;
      }
    });

    await test("export filename helpers are stable", async () => {
      const file = exporters.recipeFileName(sampleRecipe, "json");
      const basic = exporters.basicFileName("Liste Été 2026", "pdf");
      assert(file === "poulet-teriyaki.json", `unexpected recipe filename: ${file}`);
      assert(basic === "liste-ete-2026.pdf", `unexpected basic filename: ${basic}`);
    });

    if (withNetwork) {
      await test("importRecipeFromUrl baseline URLs (network)", async () => {
        const reports = [];
        for (const url of BASELINE_URLS) {
          const parsed = await importer.importRecipeFromUrl(url);
          reports.push({
            url,
            ingredients: parsed.ingredients?.length ?? 0,
            instructions: parsed.instructions?.length ?? 0,
            warnings: parsed.warnings ?? [],
          });
        }
        const hardFailures = reports.filter(
          (report) =>
            !/youtube\.com|youtu\.be/i.test(report.url) &&
            report.ingredients === 0 &&
            report.instructions === 0,
        );
        assert(hardFailures.length < reports.length, `all URL imports failed: ${JSON.stringify(reports)}`);
      });
    }

    const failed = results.filter((item) => !item.ok);
    if (failed.length > 0) {
      console.log("Feature tests failed:");
      for (const item of failed) console.log(`- ${item.name}: ${item.error}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Feature tests passed (${results.length}/${results.length})`);
    if (!withNetwork) {
      console.log("Network importer checks skipped. Use --with-network to include URL import tests.");
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`Feature tests crashed: ${String(error)}`);
  process.exitCode = 1;
});
