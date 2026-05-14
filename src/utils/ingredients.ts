import type { Ingredient } from "../types";
import { createId } from "./id";
import { normalizeText } from "./text";

const KNOWN_UNITS = [
  "cuillères à soupe",
  "cuillère à soupe",
  "cuillères à café",
  "cuillère à café",
  "c. à soupe",
  "c. à café",
  "gousses",
  "gousse",
  "pincées",
  "pincée",
  "verres",
  "verre",
  "sachets",
  "sachet",
  "boîtes",
  "boîte",
  "tranches",
  "tranche",
  "feuilles",
  "feuille",
  "branches",
  "branche",
  "bouquets",
  "bouquet",
  "pots",
  "pot",
  "kg",
  "g",
  "l",
  "cl",
  "ml",
];

export function parseIngredientLine(line: string): Ingredient {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(\d+(?:[,.]\d+)?|½|¼|¾|⅓|⅔)\s+(.+)$/);

  if (!match) {
    return { id: createId(), name: trimmed };
  }

  const [, quantity, rest] = match;
  const unit = KNOWN_UNITS.find((candidate) => rest.toLowerCase().startsWith(`${candidate} `));

  if (!unit) {
    return {
      id: createId(),
      quantity,
      name: rest,
    };
  }

  return {
    id: createId(),
    quantity,
    unit,
    name: rest.slice(unit.length).trim().replace(/^d['’]\s*|^de\s+|^du\s+|^des\s+/, ""),
  };
}

const INGREDIENT_FAMILIES: Record<string, string[]> = {
  concombre: ["concombre", "concombres"],
  yaourt: [
    "yaourt",
    "yaourts",
    "yaourt nature",
    "yaourts nature",
    "yaourts natures",
    "yaourt brasse",
    "yaourts brasses",
    "yaourt nature brasse",
    "yaourts natures brasses",
  ],
  fraise: ["fraise", "fraises"],
  jus_citron: ["jus citron", "jus de citron"],
  citron: ["citron", "citrons", "zeste de citron"],
  menthe: ["menthe", "feuilles de menthe", "feuille de menthe"],
  sucre: ["sucre", "sucre de canne", "sucre de canne liquide", "cassonade"],
  ail: ["ail", "gousse ail", "gousses ail"],
  huile_olive: ["huile olive", "huile d olive", "huile d olives"],
  vinaigre: ["vinaigre", "vinaigre vin", "vinaigre de vin", "vinaigre de vin blanc"],
  sel: ["sel", "gros sel", "fleur de sel"],
  poivre: ["poivre", "poivre noir", "poivre blanc"],
  huile: ["huile", "huile neutre", "huile tournesol", "huile de tournesol", "huile colza", "huile de colza"],
  farine: ["farine", "farine ble", "farine de ble"],
  beurre: ["beurre", "beurre doux", "beurre demi sel"],
  lait: ["lait", "lait entier", "lait demi ecreme", "lait ecreme"],
  oeuf: ["oeuf", "oeufs"],
};

const ALWAYS_PANTRY_KEYS = new Set(["sel", "poivre", "huile"]);
const LOW_QUANTITY_PANTRY_KEYS = new Set([
  "ail",
  "beurre",
  "farine",
  "huile_olive",
  "jus_citron",
  "lait",
  "sucre",
  "vinaigre",
]);

const FAMILY_VARIANTS = Object.entries(INGREDIENT_FAMILIES)
  .flatMap(([family, variants]) => variants.map((variant) => ({ family, variant: normalizeText(variant) })))
  .sort((a, b) => b.variant.length - a.variant.length);

export function canonicalIngredientKey(value: string) {
  const normalized = normalizeText(value);
  const match = FAMILY_VARIANTS.find(({ variant }) => containsWords(normalized, variant));

  if (match) return match.family;

  return normalized
    .split(" ")
    .map(singularizeToken)
    .join(" ");
}

export function ingredientSearchText(value: string) {
  return `${normalizeText(value)} ${canonicalIngredientKey(value).replace(/_/g, " ")}`;
}

export function isPantryIngredient(ingredient: Pick<Ingredient, "name" | "quantity" | "unit"> | string) {
  const value = typeof ingredient === "string" ? ingredient : ingredient.name;
  const key = canonicalIngredientKey(value);

  if (ALWAYS_PANTRY_KEYS.has(key)) return true;
  if (!LOW_QUANTITY_PANTRY_KEYS.has(key) || typeof ingredient === "string") return false;

  return isLowQuantityForKey(key, ingredient);
}

function isLowQuantityForKey(key: string, ingredient: Pick<Ingredient, "quantity" | "unit">) {
  const quantity = parseQuantity(ingredient.quantity);
  const unit = normalizeText(ingredient.unit ?? "");

  if (quantity === undefined) return false;

  if (key === "farine" || key === "sucre") return isAtMostGrams(quantity, unit, 50);
  if (key === "beurre") return isAtMostGrams(quantity, unit, 25);
  if (key === "vinaigre") return isAtMostCentiliters(quantity, unit, 5);
  if (key === "jus_citron") return isAtMostCentiliters(quantity, unit, 5);
  if (key === "lait") return isAtMostCentiliters(quantity, unit, 10);
  if (key === "ail") return isCountOrUnitAtMost(quantity, unit, ["gousse", "gousses"], 1);
  if (key === "huile_olive") return isAtMostCentiliters(quantity, unit, 5);

  return false;
}

function isAtMostGrams(quantity: number, unit: string, grams: number) {
  if (!unit || ["g", "gramme", "grammes"].includes(unit)) return quantity <= grams;
  if (["kg", "kilo", "kilos"].includes(unit)) return quantity <= grams / 1000;
  return false;
}

function isAtMostCentiliters(quantity: number, unit: string, centiliters: number) {
  if (["cl"].includes(unit)) return quantity <= centiliters;
  if (["ml"].includes(unit)) return quantity <= centiliters * 10;
  if (["l", "litre", "litres"].includes(unit)) return quantity <= centiliters / 100;
  if (unit.includes("soupe")) return quantity * 1.5 <= centiliters;
  if (unit.includes("cafe")) return quantity * 0.5 <= centiliters;
  if (unit.includes("cuillere") || unit.includes("c a")) return quantity * 1.5 <= centiliters;
  return false;
}

function isCountOrUnitAtMost(quantity: number, unit: string, units: string[], limit: number) {
  return !unit || units.includes(unit) ? quantity <= limit : false;
}

function parseQuantity(value?: string) {
  if (!value) return undefined;
  if (value === "½") return 0.5;
  if (value === "¼") return 0.25;
  if (value === "¾") return 0.75;
  if (value === "⅓") return 1 / 3;
  if (value === "⅔") return 2 / 3;

  const normalized = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : undefined;
}

function containsWords(value: string, candidate: string) {
  return new RegExp(`(^| )${escapeRegExp(candidate)}( |$)`).test(value);
}

function singularizeToken(value: string) {
  if (value.endsWith("aux") && value.length > 4) return `${value.slice(0, -3)}al`;
  if (value.endsWith("es") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
