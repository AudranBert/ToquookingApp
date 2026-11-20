import type { ParsedRecipe } from "../types";
import { cleanText } from "./text";
import { parseIngredientLine } from "../utils/ingredients";

export function parseRecipeFromToqueShareText(content: string): ParsedRecipe | null {
  if (!/\bIngredients:\s*$/im.test(content) || !/\bInstructions:\s*$/im.test(content)) return null;
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const name = cleanText(nonEmpty[0] ?? "");
  if (!name) return null;

  const metaLine =
    nonEmpty.find((line) =>
      /personne\(s\)|Préparation|Preparation|Cuisson|Total|Repos/i.test(line)
    ) ?? "";
  const servings =
    Number.parseInt(metaLine.match(/(\d+)\s*personne\(s\)/i)?.[1] ?? "", 10) || undefined;
  const prepTime =
    Number.parseInt(metaLine.match(/(?:Préparation|Preparation)\s+(\d+)\s*min/i)?.[1] ?? "", 10) ||
    undefined;
  const restTime =
    Number.parseInt(metaLine.match(/Repos\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;
  const cookTime =
    Number.parseInt(metaLine.match(/Cuisson\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;
  const totalTime =
    Number.parseInt(metaLine.match(/Total\s+(\d+)\s*min/i)?.[1] ?? "", 10) || undefined;

  const tagsLine = nonEmpty.find((line) => /^Tags:\s*/i.test(line));
  const originLine = nonEmpty.find((line) => /^Origine:\s*/i.test(line));
  const sourceLine = nonEmpty.find((line) => /^Source:\s*/i.test(line));
  const videoLine = nonEmpty.find((line) => /^Video:\s*/i.test(line));
  const imageLine = nonEmpty.find((line) => /^Image:\s*/i.test(line));
  const notesStart = lines.findIndex((line) => /^Notes:\s*$/i.test(line.trim()));

  const ingredientsStart = lines.findIndex((line) => /^Ingredients:\s*$/i.test(line.trim()));
  const instructionsStart = lines.findIndex((line) => /^Instructions:\s*$/i.test(line.trim()));
  if (ingredientsStart < 0 || instructionsStart < 0 || instructionsStart <= ingredientsStart)
    return null;

  const ingredientLines = lines
    .slice(ingredientsStart + 1, instructionsStart)
    .map((line) => cleanText(line.replace(/^\s*-\s*/, "")))
    .filter(Boolean);
  const ingredients = ingredientLines.map(parseIngredientLine);

  const instructionTail = lines.slice(instructionsStart + 1);
  const instructionStop = instructionTail.findIndex((line) =>
    /^(Notes:|Image:|Source:|Video:)\s*/i.test(line.trim())
  );
  const rawInstructionLines =
    instructionStop >= 0 ? instructionTail.slice(0, instructionStop) : instructionTail;
  const instructions = rawInstructionLines
    .map((line) => cleanText(line.replace(/^\s*\d+[.)]\s+/, "")))
    .filter(Boolean);
  const notesTail = notesStart >= 0 ? lines.slice(notesStart + 1) : [];
  const notesStop = notesTail.findIndex((line) => /^(Image:|Source:|Video:)\s*/i.test(line.trim()));
  const rawNotesLines =
    notesStart >= 0 ? (notesStop >= 0 ? notesTail.slice(0, notesStop) : notesTail) : [];
  const notes = rawNotesLines
    .map((line) => cleanText(line))
    .filter(Boolean)
    .join("\n");

  return {
    name,
    tags: tagsLine
      ? tagsLine
          .replace(/^Tags:\s*/i, "")
          .split(",")
          .map((tag) => cleanText(tag))
          .filter(Boolean)
      : undefined,
    origin: originLine ? cleanText(originLine.replace(/^Origine:\s*/i, "")) : undefined,
    ingredients: ingredients.length ? ingredients : undefined,
    instructions: instructions.length ? instructions : undefined,
    sourceUrl: sourceLine ? cleanText(sourceLine.replace(/^Source:\s*/i, "")) : undefined,
    videoUrl: videoLine ? cleanText(videoLine.replace(/^Video:\s*/i, "")) : undefined,
    imageUrl: imageLine ? cleanText(imageLine.replace(/^Image:\s*/i, "")) : undefined,
    notes: notes || undefined,
    servings,
    prepTime,
    restTime,
    cookTime,
    totalTime,
  };
}

export function parseRecipeFromToquePayloadText(content: string): ParsedRecipe | null {
  const markerMatch = content.match(
    /--\s*TOQUE_RECIPE_V2\s*--\s*([\s\S]*?)\s*--\s*\/TOQUE_RECIPE_V2\s*--/i
  )?.[1];
  const linkMatch = content.match(/[#&?]toqueRecipe=([A-Za-z0-9\-_]+)/i)?.[1];
  const payload = (markerMatch ?? linkMatch ?? "").trim();
  if (!payload) return null;

  try {
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (parsed.v !== 2 || typeof parsed.n !== "string") return null;

    const ingredients = Array.isArray(parsed.i)
      ? parsed.i
          .map((item) => {
            if (!Array.isArray(item)) return null;
            const name = cleanText(item[0]);
            if (!name) return null;
            return parseIngredientLine(
              cleanText(`${item[1] ?? ""} ${item[2] ?? ""} ${name} ${item[3] ?? ""}`)
            );
          })
          .filter((item): item is ReturnType<typeof parseIngredientLine> => Boolean(item))
      : undefined;

    const instructions = Array.isArray(parsed.s)
      ? parsed.s.map((step) => cleanText(step)).filter(Boolean)
      : undefined;
    const sourceUrl = cleanText(parsed.u);
    const videoUrl = cleanText(parsed.vv);

    return {
      name: cleanText(parsed.n),
      tags: Array.isArray(parsed.t)
        ? parsed.t.map((tag) => cleanText(tag)).filter(Boolean)
        : undefined,
      origin: cleanText(parsed.o),
      ingredients: ingredients?.length ? ingredients : undefined,
      instructions: instructions?.length ? instructions : undefined,
      sourceUrl: sourceUrl || undefined,
      videoUrl: videoUrl || undefined,
      servings: numberValue(parsed.sv),
      prepTime: numberValue(parsed.pt),
      restTime: numberValue(parsed.rt),
      cookTime: numberValue(parsed.ct),
      totalTime: numberValue(parsed.tt),
      notes: cleanText(parsed.no),
      imageUrl: cleanText(parsed.im),
      imageUrls: Array.isArray(parsed.ims)
        ? parsed.ims.map((value) => cleanText(value)).filter(Boolean)
        : undefined,
      sourceImageUrl: cleanText(parsed.si),
      sourceImageUrls: Array.isArray(parsed.sis)
        ? parsed.sis.map((value) => cleanText(value)).filter(Boolean)
        : undefined,
      warnings: undefined,
    };
  } catch {
    return null;
  }
}

export function parseRecipeFromJsonText(content: string): ParsedRecipe | null {
  if (!/^\s*[\[{]/.test(content)) return null;
  try {
    const parsed = JSON.parse(content) as unknown;
    const recipe = extractRecipeFromJsonPayload(parsed);
    if (!recipe) return null;

    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map((item) => ingredientFromJsonRecord(item))
          .filter((item): item is ReturnType<typeof parseIngredientLine> => Boolean(item))
      : undefined;
    const instructions = Array.isArray(recipe.instructions)
      ? recipe.instructions.map((step) => cleanText(step)).filter(Boolean)
      : undefined;

    return {
      name: cleanText(recipe.name),
      tags: Array.isArray(recipe.tags)
        ? recipe.tags.map((tag) => cleanText(tag)).filter(Boolean)
        : undefined,
      origin: cleanText(recipe.origin),
      ingredients: ingredients?.length ? ingredients : undefined,
      instructions: instructions?.length ? instructions : undefined,
      sourceUrl: cleanText(recipe.sourceUrl),
      videoUrl: cleanText(recipe.videoUrl),
      servings: numberValue(recipe.servings),
      prepTime: numberValue(recipe.prepTime),
      restTime: numberValue(recipe.restTime),
      cookTime: numberValue(recipe.cookTime),
      totalTime: numberValue(recipe.totalTime),
      notes: cleanText(recipe.notes),
      imageUrl: cleanText(recipe.imageUrl),
      imageUrls: Array.isArray(recipe.imageUrls)
        ? recipe.imageUrls.map((value) => cleanText(value)).filter(Boolean)
        : undefined,
      sourceImageUrl: cleanText(recipe.sourceImageUrl),
      sourceImageUrls: Array.isArray(recipe.sourceImageUrls)
        ? recipe.sourceImageUrls.map((value) => cleanText(value)).filter(Boolean)
        : undefined,
      warnings: undefined,
    };
  } catch {
    return null;
  }
}

function extractRecipeFromJsonPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.recipes) && record.recipes[0] && typeof record.recipes[0] === "object") {
    return record.recipes[0] as Record<string, unknown>;
  }
  if (
    typeof record.name === "string" &&
    (Array.isArray(record.ingredients) || Array.isArray(record.instructions))
  ) {
    return record;
  }
  return null;
}

function ingredientFromJsonRecord(item: unknown) {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = cleanText(record.name);
  if (!name) return null;
  return parseIngredientLine(cleanText(`${record.quantity ?? ""} ${record.unit ?? ""} ${name}`));
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
