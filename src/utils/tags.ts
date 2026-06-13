const TAG_MOJIBAKE_FIXES: Record<string, string> = {
  "entrÃƒÂ©e": "entrÃ©e",
  "apÃƒÂ©ritif": "apÃ©ritif",
  "pescÃƒÂ©tarien": "pescÃ©tarien",
  "vÃƒÂ©gÃƒÂ©tarien": "vÃ©gÃ©tarien",
  "vÃƒÂ©gÃƒÂ©talien": "vÃ©gÃ©talien",
};

export function repairTagName(value: string) {
  const trimmed = value.trim();
  return TAG_MOJIBAKE_FIXES[trimmed] ?? trimmed;
}

export function formatTagName(value: string) {
  const repaired = repairTagName(value).trim().replace(/\s+/g, " ");
  if (!repaired) return "";

  const lowercased = repaired.toLocaleLowerCase("fr");
  return `${lowercased.charAt(0).toLocaleUpperCase("fr")}${lowercased.slice(1)}`;
}
