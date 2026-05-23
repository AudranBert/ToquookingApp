import { en } from "./en";
import { fr } from "./fr";
import type { MessageKey, Messages } from "./types";

type Locale = "fr" | "en";

const dictionaries: Record<Locale, Messages> = { fr, en };

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem("toque.locale");
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

let currentLocale: Locale = detectLocale();

export function setLocale(locale: Locale) {
  currentLocale = locale;
  try {
    localStorage.setItem("toque.locale", locale);
  } catch {
    // ignore
  }
}

export function getLocale() {
  return currentLocale;
}

export function t(key: MessageKey, vars?: Record<string, string | number>) {
  const template = dictionaries[currentLocale][key] ?? fr[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
