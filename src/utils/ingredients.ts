import type { Ingredient } from "../types";
import { createId } from "./id";

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
