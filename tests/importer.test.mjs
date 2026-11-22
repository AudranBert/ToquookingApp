import { test } from "node:test";
import assert from "node:assert/strict";
import { readPageText, parseRecipePage, importRecipeFromUrl } from "../backend/recipe-importer.mjs";
import { createServer } from "../backend/server.mjs";
import { serverClient } from "./helpers/server-client.mjs";

test("stream limits cancel oversized pages before the remaining body is read", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readPageText(new Response(body), 10), /volumineuse/);
  assert.equal(cancelled, true);
  await assert.rejects(
    readPageText(new Response("small", { headers: { "content-length": "100" } }), 10),
    /volumineuse/
  );
  assert.equal(await readPageText(new Response("Crème"), 10), "Crème");
});

test("server prefers JSON-LD and preserves nested instructions, images and timings", () => {
  const page = `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "Recipe", name: "Crème", image: { url: "/creme.jpg" }, recipeIngredient: ["200 g de lait"], recipeInstructions: [{ "@type": "HowToSection", itemListElement: [{ text: "Chauffer." }, { text: "Servir." }] }], prepTime: "PT10M", cookTime: "PT20M" }] })}</script>\nIngrédients\n1 publicité\nPréparation\nLire les publicités.`;
  const parsed = parseRecipePage(page, "https://example.com/recipe");
  assert.equal(parsed.name, "Crème");
  assert.equal(parsed.ingredients.length, 1);
  assert.deepEqual(parsed.instructions, ["Chauffer.", "Servir."]);
  assert.equal(parsed.imageUrl, "https://example.com/creme.jpg");
  assert.equal(parsed.prepTime, 10);
  assert.equal(parsed.cookTime, 20);
});

test("private source addresses are rejected and YouTube remains a partial import", async () => {
  await assert.rejects(importRecipeFromUrl("http://127.0.0.1/private"), /privée/);
  await assert.rejects(importRecipeFromUrl("file:///etc/passwd"), /invalide/);
  const result = await importRecipeFromUrl("https://www.youtube.com/shorts/eEB6pkC4X5o");
  assert.equal(result.videoUrl, result.sourceUrl);
  assert(result.warnings.some((warning) => /partiel/.test(warning)));
});

test("HTTP import contract works without a database and validates request payloads", async (t) => {
  const source = "https://example.com/recipe";
  const request = await serverClient(
    t,
    createServer({
      recipeImporter: async (url) => {
        assert.equal(url, source);
        return parseRecipePage("Title: Soupe\nIngrédients\n2 tomates\nPréparation\nCouper.", url);
      },
    })
  );
  const post = (body) =>
    request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ url: 42 })).status, 400);
  const result = await post({ url: source });
  assert.equal(result.status, 200);
  const { recipe } = await result.json();
  assert.equal(recipe.name, "Soupe");
  assert.equal(recipe.ingredients.length, 1);
  assert.deepEqual(recipe.instructions, ["Couper."]);
});
