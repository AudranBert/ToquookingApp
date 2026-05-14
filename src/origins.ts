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
  "Amériques",
  "Antilles",
  "Asie",
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

export const POPULAR_RECIPE_ORIGINS = [
  "France",
  "Italie",
  "Japon",
  "Mexique",
  "Inde",
  "Espagne",
  "Thaïlande",
  "Maroc",
];

export const RECIPE_ORIGIN_GROUPS = [
  {
    label: "Europe",
    origins: [
      "Europe",
      "Allemagne",
      "Belgique",
      "Espagne",
      "France",
      "Grèce",
      "Italie",
      "Norvège",
      "Portugal",
      "Royaume-Uni",
      "Russie",
      "Suisse",
    ],
  },
  {
    label: "Régions françaises",
    origins: FRENCH_REGIONS,
  },
  {
    label: "Afrique & Moyen-Orient",
    origins: ["Afrique", "Méditerranée", "Moyen-Orient", "Algérie", "Liban", "Maroc", "Tunisie", "Turquie"],
  },
  {
    label: "Asie",
    origins: ["Asie", "Chine", "Corée", "Inde", "Japon", "Thaïlande", "Vietnam"],
  },
  {
    label: "Amériques",
    origins: ["Amériques", "Canada", "États-Unis", "Mexique", "Guadeloupe", "Guyane", "Martinique"],
  },
  {
    label: "Outre-mer",
    origins: ["Antilles", "Guadeloupe", "Guyane", "La Réunion", "Martinique", "Mayotte"],
  },
];

const ORIGIN_PARENTS: Record<string, string[]> = {
  Afrique: ["Algérie", "Maroc", "Tunisie"],
  Amériques: ["Canada", "États-Unis", "Mexique", "Guadeloupe", "Guyane", "Martinique"],
  Antilles: ["Guadeloupe", "Martinique"],
  Asie: ["Chine", "Corée", "Inde", "Japon", "Thaïlande", "Vietnam"],
  Europe: [
    "Allemagne",
    "Belgique",
    "Espagne",
    "France",
    "Grèce",
    "Italie",
    "Norvège",
    "Portugal",
    "Royaume-Uni",
    "Russie",
    "Suisse",
    ...FRENCH_REGIONS,
  ],
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
