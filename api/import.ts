function parseJsonLd(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const json = JSON.parse(script[1]);
      const nodes = Array.isArray(json) ? json : [json];
      const graph = nodes.flatMap((node) => (node && typeof node === "object" && Array.isArray(node["@graph"]) ? node["@graph"] : [node]));
      const recipe = graph.find((node) => {
        const type = node?.["@type"];
        return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
      });
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }
  return null;
}

function textArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function minutes(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return undefined;
  return Number(match[1] || 0) * 60 + Number(match[2] || 0);
}

export default async function handler(
  request: { query: Record<string, unknown> },
  response: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const url = String(request.query.url ?? "");
  if (!/^https?:\/\//.test(url)) {
    response.status(400).json({ warnings: ["URL invalide."] });
    return;
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    response.status(200).json({
      name: "Recette YouTube",
      sourceUrl: url,
      videoUrl: url,
      warnings: ["Import YouTube partiel : complète les ingrédients et les étapes après vérification."],
    });
    return;
  }

  try {
    const page = await fetch(url, {
      headers: {
        "user-agent": "ToqueRecipeHub/0.1 (+local recipe import)",
        accept: "text/html",
      },
    });
    const html = await page.text();
    const recipe = parseJsonLd(html);
    if (!recipe) {
      response.status(200).json({
        sourceUrl: url,
        warnings: ["Aucune donnée de recette structurée trouvée. Complète la fiche manuellement."],
      });
      return;
    }

    const instructions = Array.isArray(recipe.recipeInstructions)
      ? recipe.recipeInstructions
          .map((item: unknown) => (typeof item === "string" ? item : item && typeof item === "object" && "text" in item ? String(item.text) : ""))
          .filter(Boolean)
      : textArray(recipe.recipeInstructions);

    response.status(200).json({
      name: typeof recipe.name === "string" ? recipe.name : undefined,
      sourceUrl: url,
      ingredients: textArray(recipe.recipeIngredient).map((name) => ({ id: crypto.randomUUID(), name })),
      instructions,
      servings: typeof recipe.recipeYield === "string" ? Number.parseInt(recipe.recipeYield, 10) || undefined : undefined,
      prepTime: minutes(recipe.prepTime),
      cookTime: minutes(recipe.cookTime),
      totalTime: minutes(recipe.totalTime),
      imageUrl: textArray(recipe.image)[0],
      warnings: ["Import assisté : vérifie les quantités et les étapes avant d'enregistrer."],
    });
  } catch {
    response.status(200).json({
      sourceUrl: url,
      warnings: ["Impossible de lire ce lien pour le moment. Le lien est gardé pour une saisie manuelle."],
    });
  }
}
