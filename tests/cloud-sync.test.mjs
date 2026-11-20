import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import "fake-indexeddb/auto";

test("frontend: durable queue, offline replay, edit during upload, scope isolation and safe merge", async (t) => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.window = {
    dispatchEvent() {},
    location: { href: "https://app.example/ToquookingApp/", hash: "" },
  };
  const folder = await mkdtemp(path.join(tmpdir(), "toque-cloud-"));
  const outfile = path.join(folder, "client.mjs");
  await build({
    stdin: {
      contents: `export { db } from './src/db'; export * from './src/cloud/settings'; export * from './src/data/recipeRepository'; export * from './src/cloud/queue'; export * from './src/cloud/transfers'; export * from './src/cloud/sharing'; export * from './src/cloud/validation'; export * from './src/cloud/healthMonitor'; export * from './src/cloud/recipePayload'; export * from './src/cloud/trash';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    define: { "import.meta.env.BASE_URL": JSON.stringify("/ToquookingApp/") },
    logLevel: "silent",
  });
  const client = await import(pathToFileURL(outfile).href);
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await client.db.delete();
    await rm(folder, { recursive: true, force: true });
  });
  const recipe = {
    id: "recipe-1",
    name: "Soupe",
    imageUrl: "https://images.example/cover.jpg",
    imageUrls: ["https://images.example/cover.jpg", "data:image/png;base64,Yg=="],
    sourceImageUrl: "data:image/png;base64,Yw==",
    sourceImageUrls: ["data:image/png;base64,Yw==", "https://images.example/original.jpg"],
    tags: [],
    ingredients: [],
    instructions: [],
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
  };
  const initial = client.initializeCloudSettings();
  assert.match(initial.key, /^[a-f0-9]{64}$/);
  assert.equal(initial.apiUrl, "");
  assert.equal(initial.autoBackup, false);
  assert.equal(client.initializeCloudSettings().key, initial.key);
  await client.putRecipe(recipe);
  assert.equal(await client.db.cloudQueue.count(), 0); // all local by default
  client.writeCloudSettings({ apiUrl: "https://api.example/", key: "", autoBackup: false });
  assert.match(client.readCloudSettings().key, /^[a-f0-9]{64}$/);
  client.writeCloudSettings({ ...client.readCloudSettings(), autoBackup: true });
  const settings = client.readCloudSettings();
  assert.match(settings.key, /^[a-f0-9]{64}$/);
  client.writeCloudSettings({ ...settings, autoBackup: false });
  client.writeCloudSettings({ ...client.readCloudSettings(), autoBackup: true });
  assert.equal(client.readCloudSettings().key, settings.key);
  assert.throws(() => client.writeCloudSettings({ ...settings, apiUrl: "http://unsafe.example" }));
  await client.putRecipe(recipe);
  await client.putRecipe({ ...recipe, name: "Dernière version" });
  assert.equal(await client.db.cloudQueue.count(), 1);
  const queuedCover = (await client.db.cloudQueue.toArray())[0].recipe;
  assert.equal(queuedCover.imageUrl, recipe.imageUrl);
  assert.equal(queuedCover.imageUrls, undefined);
  assert.equal(queuedCover.sourceImageUrl, undefined);
  assert.equal(queuedCover.sourceImageUrls, undefined);
  assert.equal((await client.db.recipes.get(recipe.id)).imageUrls.length, 2);
  // Queues saved by old app versions must be compacted at the network boundary too.
  await client.db.cloudQueue.update([client.cloudTarget(), recipe.id], {
    recipe: { ...recipe, name: "Dernière version" },
  });
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  await assert.rejects(client.flushCloudQueue());
  client.db.close();
  await client.db.open();
  assert.equal(await client.db.cloudQueue.count(), 1); // survives reopening the device database
  const sent = [];
  let duringUpload = true;
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    if (duringUpload) {
      duringUpload = false;
      await client.putRecipe({ ...recipe, name: "Modifiée pendant l’envoi" });
    }
    return Response.json({ ok: true });
  };
  await client.flushCloudQueue();
  assert.equal(sent.length, 2);
  assert.equal(sent[0].mutations[0].recipe.name, "Dernière version");
  for (const batch of sent) {
    const payload = batch.mutations[0].recipe;
    assert.equal(payload.imageUrl, recipe.imageUrl);
    assert.equal(payload.imageUrls, undefined);
    assert.equal(payload.sourceImageUrl, undefined);
    assert.equal(payload.sourceImageUrls, undefined);
  }
  assert.equal(sent[1].mutations[0].recipe.name, "Modifiée pendant l’envoi");
  assert.equal(await client.db.cloudQueue.count(), 0);
  globalThis.fetch = async () =>
    Response.json({
      recipes: [
        {
          ...client.toCloudRecipe(recipe),
          imageUrl: "https://images.example/new-cover.jpg",
          updatedAt: "2026-11-21T12:00:00Z",
        },
      ],
    });
  assert.equal(await client.downloadCloudRecipes(), 1);
  const restored = await client.db.recipes.get(recipe.id);
  assert.equal(restored.imageUrl, "https://images.example/new-cover.jpg");
  assert(restored.imageUrls.includes(recipe.imageUrls[1]));
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return Response.json({ ok: true });
  };
  client.writeCloudSettings({ ...settings, autoBackup: false });
  await client.deleteRecipe(recipe.id);
  assert.equal((await client.db.cloudQueue.toArray())[0].operation, "delete");
  await client.flushCloudQueue();
  assert.equal(sent.at(-1).mutations[0].operation, "delete");
  await client.putRecipe(recipe);
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  await assert.rejects(client.uploadLocalRecipes());
  assert.equal((await client.db.cloudQueue.toArray())[0].manual, true);
  assert.equal((await client.db.cloudQueue.toArray())[0].recipe.imageUrls, undefined);
  globalThis.fetch = async () => Response.json({ ok: true });
  await client.flushCloudQueue(); // manually requested backups retry with auto off
  assert.equal(await client.db.cloudQueue.count(), 0);
  client.writeCloudSettings(settings);
  await client.putRecipe(recipe);
  client.writeCloudSettings({ ...settings, key: "b".repeat(64) });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ ok: true });
  };
  await client.flushCloudQueue();
  assert.equal(calls, 0); // another cloud space never receives the old space's queue
  client.writeCloudSettings(settings);
  globalThis.fetch = async () =>
    Response.json({
      recipes: [
        { ...recipe, name: "Cloud", updatedAt: "2026-11-21T10:00:00Z" },
        { ...recipe, id: "recipe-2" },
      ],
    });
  assert.equal(await client.downloadCloudRecipes(), 1);
  assert.equal((await client.db.recipes.get(recipe.id)).name, recipe.name); // local pending wins
  let publicAuthorization;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      const payload = JSON.parse(options.body).recipe;
      assert.equal(payload.imageUrl, recipe.imageUrl);
      assert.equal(payload.imageUrls, undefined);
      assert.equal(payload.sourceImageUrls, undefined);
      return Response.json({ shareId: "12345678-1234-1234-1234-123456789012" });
    }
    publicAuthorization = options.headers?.Authorization;
    assert.equal(url, "https://api.example/shares/12345678-1234-1234-1234-123456789012");
    return Response.json({ recipe });
  };
  const share = await client.createCloudShare(recipe);
  assert(!share.includes(settings.key));
  assert(!share.includes("Soupe"));
  window.location.hash = new URL(share).hash;
  assert.equal((await client.readCloudShareFromLocation()).name, recipe.name);
  assert.equal(publicAuthorization, undefined); // opening another server's link cannot leak the key
  const unsafe = client.parseCloudRecipe({
    ...recipe,
    sourceUrl: "javascript:alert(1)",
    imageUrl: "data:image/svg+xml,unsafe",
  });
  assert.equal(unsafe.sourceUrl, undefined);
  assert.equal(unsafe.imageUrl, undefined);
  assert.throws(() => client.parseCloudRecipe({ ...recipe, instructions: [123] }));

  const failQueue = () => {
    throw Error("queue storage failure");
  };
  client.db.cloudQueue.hook("creating", failQueue);
  await assert.rejects(client.putRecipe({ ...recipe, id: "atomic-failure" }));
  assert.equal(await client.db.recipes.get("atomic-failure"), undefined);
  client.db.cloudQueue.hook("creating").unsubscribe(failQueue);

  const batches = [];
  globalThis.fetch = async (_url, options) => {
    batches.push(JSON.parse(options.body).mutations);
    return Response.json({ ok: true });
  };
  await client.putRecipes(
    Array.from({ length: 26 }, (_, index) => ({ ...recipe, id: `batch-${index}` }))
  );
  await client.flushCloudQueue();
  assert.equal(batches.length, 2);
  assert(batches.every((batch) => batch.length <= 25));
  assert.equal(batches.flat().length, 27);
  assert.equal(await client.db.cloudQueue.count(), 0);

  const recovered = {
    ...client.toCloudRecipe(recipe),
    id: "recovered-recipe",
    name: "Restaurée",
    updatedAt: "2026-11-22T12:00:00Z",
  };
  const localRecovery = { ...recipe, id: recovered.id };
  await client.db.recipes.put(localRecovery);
  globalThis.fetch = async () => Response.json({ recipe: recovered });
  assert.equal(await client.restoreCloudRecipe(recovered.id, settings), true);
  assert.equal((await client.db.recipes.get(recovered.id)).name, recovered.name);
  assert((await client.db.recipes.get(recovered.id)).imageUrls.includes(recipe.imageUrls[1]));
  assert.equal(await client.db.cloudQueue.count(), 0); // restoration never queues a redundant upload

  globalThis.fetch = async () => {
    await client.putRecipe({
      ...localRecovery,
      name: "Modification locale pendant la restauration",
    });
    return Response.json({ recipe: recovered });
  };
  assert.equal(await client.restoreCloudRecipe(recovered.id, settings), false);
  assert.equal(
    (await client.db.recipes.get(recovered.id)).name,
    "Modification locale pendant la restauration"
  );
  globalThis.fetch = async () => Response.json({ ok: true });
  await client.flushCloudQueue();

  globalThis.fetch = async () => {
    await client.deleteRecipe(recovered.id);
    return Response.json({ recipe: recovered });
  };
  assert.equal(await client.restoreCloudRecipe(recovered.id, settings), false);
  assert.equal(await client.db.recipes.get(recovered.id), undefined);
  assert.equal((await client.db.cloudQueue.toArray())[0].operation, "delete");
  globalThis.fetch = async () => Response.json({ ok: true });
  await client.flushCloudQueue();

  globalThis.fetch = async () => {
    client.writeCloudSettings({ ...settings, key: "b".repeat(64) });
    return Response.json({ recipe: recovered });
  };
  await assert.rejects(client.restoreCloudRecipe(recovered.id, settings));
  assert.equal(await client.db.recipes.get(recovered.id), undefined);
  client.writeCloudSettings(settings);
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  await assert.rejects(client.restoreCloudRecipe(recovered.id, settings));
  assert.equal(await client.db.recipes.get(recovered.id), undefined);

  globalThis.fetch = async () =>
    Response.json({
      recipes: [{ id: "bad", name: "Bad", deletedAt: "invalid", expiresAt: "invalid" }],
    });
  await assert.rejects(client.listCloudTrash(settings));
  const localCount = await client.db.recipes.count();
  globalThis.fetch = async () => Response.json({ ok: true });
  await client.purgeCloudRecipe(recovered.id, settings);
  await client.emptyCloudTrash(settings);
  assert.equal(await client.db.recipes.count(), localCount); // purging cloud trash cannot erase local recipes

  client.writeCloudSettings({ apiUrl: "", key: settings.key, autoBackup: false });
  let defaultsRequests = 0;
  globalThis.fetch = async () => {
    defaultsRequests++;
    return Response.json({ apiUrl: "https://default.example" });
  };
  await client.loadCloudDefaults();
  assert.equal(defaultsRequests, 1);
  assert.equal(client.readCloudSettings().apiUrl, ""); // explicit disabling survives new deployment defaults
  client.writeCloudSettings({ ...client.readCloudSettings(), serverMode: "default" });
  await client.loadCloudDefaults();
  assert.equal(client.readCloudSettings().apiUrl, "https://default.example");
  assert.equal(client.readCloudSettings().key, settings.key);
  assert.equal(client.readCloudSettings().autoBackup, false);
  client.writeCloudSettings({ ...settings, serverMode: "custom" });
  await client.loadCloudDefaults();
  assert.equal(client.readCloudSettings().apiUrl, "https://api.example"); // personal server is never overwritten

  t.mock.timers.enable({ apis: ["setInterval"] });
  let healthChecks = 0;
  let releaseCheck;
  const stopPolling = client.startHealthPolling(async () => {
    healthChecks++;
    if (healthChecks === 2)
      await new Promise((resolve) => {
        releaseCheck = resolve;
      });
  });
  assert.equal(healthChecks, 1);
  await Promise.resolve();
  t.mock.timers.tick(10000);
  assert.equal(healthChecks, 2);
  t.mock.timers.tick(30000);
  assert.equal(healthChecks, 2); // no overlapping requests while the server wakes up
  releaseCheck();
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(10000);
  assert.equal(healthChecks, 3);
  stopPolling();
  t.mock.timers.tick(20000);
  assert.equal(healthChecks, 3); // leaving Backup stops the monitor
  t.mock.timers.reset();
});
