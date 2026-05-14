import { normalizeText } from "./utils/text";

const FRENCH_REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Guadeloupe",
  "Guyane",
  "Hauts-de-France",
  "Île-de-France",
  "La Réunion",
  "Martinique",
  "Mayotte",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
];

export const RECIPE_ORIGINS = [
  "Afrique",
  "Allemagne",
  "Algérie",
  "Antilles",
  "Belgique",
  "Canada",
  "Chine",
  "Corée",
  "Espagne",
  "États-Unis",
  "Europe",
  "France",
  "Grèce",
  "Inde",
  "Italie",
  "Japon",
  "Liban",
  "Maroc",
  "Méditerranée",
  "Mexique",
  "Moyen-Orient",
  "Norvège",
  "Portugal",
  "Royaume-Uni",
  "Russie",
  "Suisse",
  "Thaïlande",
  "Tunisie",
  "Turquie",
  "Vietnam",
  ...FRENCH_REGIONS,
].sort((a, b) => a.localeCompare(b, "fr")) as string[];

const ORIGIN_PARENTS: Record<string, string[]> = {
  Afrique: ["Algérie", "Maroc", "Tunisie"],
  Antilles: ["Guadeloupe", "Martinique"],
  Europe: ["Allemagne", "Belgique", "Espagne", "France", "Grèce", "Italie", "Norvège", "Portugal", "Royaume-Uni", "Russie", "Suisse", ...FRENCH_REGIONS],
  France: FRENCH_REGIONS,
  Méditerranée: ["Espagne", "France", "Grèce", "Italie", "Liban", "Maroc", "Portugal", "Tunisie", "Turquie"],
  "Moyen-Orient": ["Liban", "Turquie"],
};

export function originMatchesFilter(origin: string | undefined, filter: string) {
  if (!filter) return true;
  if (!origin) return false;

  const normalizedOrigin = normalizeText(origin);
  const normalizedFilter = normalizeText(filter);

  if (normalizedOrigin === normalizedFilter) return true;

  return (ORIGIN_PARENTS[filter] ?? []).some((child) => normalizeText(child) === normalizedOrigin);
}
