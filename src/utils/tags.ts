import { DEFAULT_RECIPE_TOOLS } from "../constants";
import { t } from "../i18n";
import { normalizeText } from "./text";

const TAG_MOJIBAKE_FIXES: Record<string, string> = {
  "entrÃƒÂ©e": "entrÃ©e",
  "apÃƒÂ©ritif": "apÃ©ritif",
  "pescÃƒÂ©tarien": "pescÃ©tarien",
  "vÃƒÂ©gÃƒÂ©tarien": "vÃ©gÃ©tarien",
  "vÃƒÂ©gÃƒÂ©talien": "vÃ©gÃ©talien",
};

const toolNameByKey = new Map(DEFAULT_RECIPE_TOOLS.map((tool) => [normalizeText(tool), tool]));

const localizedTagKeys = new Set(["preparation", "brouillon"]);

export function repairTagName(value: string) {
  const trimmed = value.trim();
  return TAG_MOJIBAKE_FIXES[trimmed] ?? trimmed;
}

export function formatTagName(value: string) {
  const repaired = repairTagName(value).trim().replace(/\s+/g, " ");
  if (!repaired) return "";

  const canonicalToolName = toolNameByKey.get(normalizeText(repaired));
  if (canonicalToolName) return canonicalToolName;

  const lowercased = repaired.toLocaleLowerCase("fr");
  return `${lowercased.charAt(0).toLocaleUpperCase("fr")}${lowercased.slice(1)}`;
}

export function displayTagName(value: string) {
  const canonical = formatTagName(value);
  if (!canonical) return "";

  const normalized = normalizeText(canonical);
  const canonicalToolName = toolNameByKey.get(normalized);
  const label = canonicalToolName
    ? t(`recipe.tools.${canonicalToolName}` as never)
    : localizedTagKeys.has(normalized)
      ? t(`recipe.tags.${normalized}` as never)
      : canonical;
  return `${label.charAt(0).toLocaleUpperCase("fr")}${label.slice(1)}`;
}
