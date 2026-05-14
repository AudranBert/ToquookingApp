export type SeasonalCategory = "fruits-legumes" | "poissons-fruits-de-mer";

export type SeasonalMonth = {
  fruitsLegumes: string[];
  poissonsFruitsDeMer: string[];
};

export const MONTH_NAMES = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

export const SEASONAL_SOURCE_URL =
  "https://www.mangerbouger.fr/manger-mieux/bien-manger-sans-se-ruiner/calendrier-de-saison";

export const seasonalCalendar: Record<number, SeasonalMonth> = {
  0: {
    fruitsLegumes: [
      "betterave",
      "carotte",
      "celeri",
      "chou",
      "chou-fleur",
      "courge",
      "endive",
      "mache",
      "navet",
      "poireau",
      "pomme",
      "poire",
    ],
    poissonsFruitsDeMer: ["bar", "coquille saint-jacques", "huitre", "lieu", "merlan", "moule"],
  },
  1: {
    fruitsLegumes: [
      "betterave",
      "carotte",
      "celeri",
      "chou",
      "chou-fleur",
      "endive",
      "kiwi",
      "mache",
      "navet",
      "poireau",
      "pomme",
    ],
    poissonsFruitsDeMer: ["cabillaud", "coquille saint-jacques", "huitre", "lieu", "merlan", "raie"],
  },
  2: {
    fruitsLegumes: [
      "asperge",
      "betterave",
      "carotte",
      "celeri",
      "chou-fleur",
      "endive",
      "kiwi",
      "poireau",
      "radis",
      "pomme",
    ],
    poissonsFruitsDeMer: ["cabillaud", "colin", "dorade", "lieu", "maquereau", "merlan"],
  },
  3: {
    fruitsLegumes: [
      "artichaut",
      "asperge",
      "carotte",
      "chou-fleur",
      "concombre",
      "epinard",
      "fraise",
      "navet",
      "petit pois",
      "radis",
      "rhubarbe",
      "salade",
    ],
    poissonsFruitsDeMer: ["cabillaud", "colin", "dorade", "maquereau", "sardine", "saumon"],
  },
  4: {
    fruitsLegumes: [
      "artichaut",
      "asperge",
      "carotte",
      "chou rouge",
      "concombre",
      "courgette",
      "cresson",
      "epinard",
      "fenouil",
      "fraise",
      "navet",
      "oseille",
      "pamplemousse",
      "petit pois",
      "pois gourmand",
      "radis",
      "rhubarbe",
      "salade",
    ],
    poissonsFruitsDeMer: ["brochet", "cabillaud", "colin", "dorade", "hareng", "homard", "saumon"],
  },
  5: {
    fruitsLegumes: [
      "abricot",
      "artichaut",
      "aubergine",
      "carotte",
      "cerise",
      "concombre",
      "courgette",
      "fenouil",
      "fraise",
      "framboise",
      "haricot vert",
      "melon",
      "poivron",
      "tomate",
    ],
    poissonsFruitsDeMer: ["bar", "dorade", "homard", "maquereau", "sardine", "thon"],
  },
  6: {
    fruitsLegumes: [
      "abricot",
      "aubergine",
      "betterave",
      "concombre",
      "courgette",
      "framboise",
      "haricot vert",
      "melon",
      "myrtille",
      "peche",
      "poivron",
      "tomate",
    ],
    poissonsFruitsDeMer: ["bar", "dorade", "maquereau", "moule", "sardine", "thon"],
  },
  7: {
    fruitsLegumes: [
      "aubergine",
      "concombre",
      "courgette",
      "figue",
      "framboise",
      "haricot vert",
      "melon",
      "mirabelle",
      "peche",
      "poivron",
      "prune",
      "tomate",
    ],
    poissonsFruitsDeMer: ["bar", "dorade", "maquereau", "moule", "sardine", "thon"],
  },
  8: {
    fruitsLegumes: [
      "aubergine",
      "betterave",
      "cepe",
      "concombre",
      "courgette",
      "figue",
      "haricot vert",
      "melon",
      "poire",
      "poivron",
      "pomme",
      "raisin",
      "tomate",
    ],
    poissonsFruitsDeMer: ["bar", "dorade", "maquereau", "moule", "sardine", "sole"],
  },
  9: {
    fruitsLegumes: [
      "betterave",
      "brocoli",
      "carotte",
      "celeri",
      "chataigne",
      "chou",
      "coing",
      "courge",
      "endive",
      "poire",
      "pomme",
      "raisin",
    ],
    poissonsFruitsDeMer: ["bar", "cabillaud", "coquille saint-jacques", "huitre", "moule", "sole"],
  },
  10: {
    fruitsLegumes: [
      "betterave",
      "carotte",
      "celeri",
      "chou",
      "courge",
      "endive",
      "mache",
      "navet",
      "poire",
      "poireau",
      "pomme",
    ],
    poissonsFruitsDeMer: ["cabillaud", "coquille saint-jacques", "hareng", "huitre", "lieu", "merlan"],
  },
  11: {
    fruitsLegumes: [
      "betterave",
      "carotte",
      "celeri",
      "chou",
      "courge",
      "endive",
      "mache",
      "navet",
      "poireau",
      "pomme",
    ],
    poissonsFruitsDeMer: ["cabillaud", "coquille saint-jacques", "huitre", "lieu", "merlan", "saumon"],
  },
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function currentSeasonalIngredients(date = new Date()) {
  const month = seasonalCalendar[date.getMonth()];
  return [...month.fruitsLegumes, ...month.poissonsFruitsDeMer];
}

export function recipeContainsSeasonalIngredient(ingredientNames: string[], seasonals: string[]) {
  const haystack = normalizeText(ingredientNames.join(" "));
  return seasonals.some((ingredient) => haystack.includes(normalizeText(ingredient)));
}
