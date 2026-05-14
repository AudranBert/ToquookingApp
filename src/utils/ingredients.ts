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
  citron: ["citron", "citrons", "jus de citron", "zeste de citron"],
  menthe: ["menthe", "feuilles de menthe", "feuille de menthe"],
  sucre: ["sucre", "sucre de canne", "sucre de canne liquide", "cassonade"],
  ail: ["ail", "gousse ail", "gousses ail"],
  huile_olive: ["huile olive", "huile d olive", "huile d olives"],
  vinaigre: ["vinaigre", "vinaigre vin", "vinaigre de vin", "vinaigre de vin blanc"],
};

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
