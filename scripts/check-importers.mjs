import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_URLS = [
  "https://www.cuisine-libre.org/osso-bucco-lombard",
  "https://www.marmiton.org/recettes/recette_pot-au-feu-facile_44578.aspx",
  "https://www.cuisineaz.com/recettes/tzatziki-facile-17295.aspx",
  "https://www.papillesetpupilles.fr/2026/05/cotes-de-porc-au-citron-et-au-thym-cuisson-douce-au-four.html/",
  "https://www.cuisineactuelle.fr/recettes/pizza-facile-106483.aspx",
  "https://www.youtube.com/shorts/eEB6pkC4X5o",
];

function parseArgs(argv) {
  const args = { json: false, urls: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--json") {
      args.json = true;
      continue;
    }
    if (current === "--url" && argv[i + 1]) {
      args.urls.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (current.startsWith("http://") || current.startsWith("https://")) {
      args.urls.push(current);
    }
  }
  return args;
}

function hasPartialWarning(warnings) {
  return warnings.some((warning) => /import partiel/i.test(warning));
}

function hasInvalidTitle(name, url) {
  const title = String(name ?? "").trim();
  if (!title) return true;
  if (/^noname$/i.test(title)) return true;
  if (/^just a moment\b/i.test(title)) return true;
  if (/attention required|cloudflare|checking your browser/i.test(title)) return true;
  if (/youtube\.com|youtu\.be/i.test(url) && /^(subscribe|s['’]abonner)$/i.test(title)) return true;
  return false;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const urls = args.urls.length > 0 ? args.urls : DEFAULT_URLS;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "toquooking-import-check-"));
  const outFile = path.join(tempDir, "importer.bundle.mjs");

  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: { hostname: "github.io" },
  };

  try {
    await build({
      entryPoints: [path.resolve("src/importer.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: outFile,
      logLevel: "silent",
    });

    const { importRecipeFromUrl } = await import(pathToFileURL(outFile).href);
    const results = [];

    for (const url of urls) {
      try {
        const recipe = await importRecipeFromUrl(url);
        const warnings = recipe.warnings ?? [];
        const invalidTitle = hasInvalidTitle(recipe.name, url);
        results.push({
          url,
          ok:
            !invalidTitle &&
            ((recipe.ingredients?.length ?? 0) > 0 || (recipe.instructions?.length ?? 0) > 0 || /youtube\.com|youtu\.be/i.test(url)),
          name: recipe.name ?? "",
          ingredients: recipe.ingredients?.length ?? 0,
          instructions: recipe.instructions?.length ?? 0,
          hasImage: Boolean(recipe.imageUrl),
          invalidTitle,
          partial: hasPartialWarning(warnings),
          warnings,
        });
      } catch (error) {
        results.push({
          url,
          ok: false,
          error: String(error),
        });
      }
    }

    if (args.json) {
      process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
      return;
    }

    const lines = [];
    lines.push("Importer check results:");
    for (const result of results) {
      if ("error" in result) {
        lines.push(`- FAIL ${result.url}`);
        lines.push(`  error: ${result.error}`);
        continue;
      }
      const status = result.ok ? (result.partial ? "PARTIAL" : "OK") : "FAIL";
      lines.push(`- ${status} ${result.url}`);
      lines.push(`  name: ${result.name || "(none)"}`);
      lines.push(`  ingredients: ${result.ingredients}, instructions: ${result.instructions}, image: ${result.hasImage ? "yes" : "no"}`);
      if (result.invalidTitle) lines.push("  invalid-title: yes");
      if (result.warnings.length > 0) lines.push(`  warnings: ${result.warnings.join(" | ")}`);
    }
    process.stdout.write(`${lines.join("\n")}\n`);

    const hasFailure = results.some((result) => "error" in result || !result.ok);
    if (hasFailure) process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  process.stderr.write(`Importer check failed: ${String(error)}\n`);
  process.exitCode = 1;
});
