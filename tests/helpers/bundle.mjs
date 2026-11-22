import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadClient(t, contents) {
  const folder = await mkdtemp(path.join(tmpdir(), "toque-regression-"));
  const outfile = path.join(folder, "client.mjs");
  t.after(() => rm(folder, { recursive: true, force: true }));
  await build({
    stdin: { contents, resolveDir: process.cwd() },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    define: { "import.meta.env.BASE_URL": JSON.stringify("/ToquookingApp/") },
    logLevel: "silent",
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
  return import(pathToFileURL(outfile).href);
}
