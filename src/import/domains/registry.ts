import type { ParsedRecipe } from "../../types";
import { marmitonFallback } from "./marmiton";
import { cuisineLibreFallback } from "./cuisineLibre";
import { cuisineAzFallback } from "./cuisineAz";
import { papillesEtPupillesFallback } from "./papillesEtPupilles";
import { cuisineActuelleFallback } from "./cuisineActuelle";

type DomainParser = (content: string, sourceUrl: string) => ParsedRecipe | null;

const DOMAIN_PARSERS: Array<{ hostPattern: RegExp; parser: DomainParser }> = [
  { hostPattern: /(^|\.)marmiton\.org$/i, parser: marmitonFallback },
  { hostPattern: /(^|\.)cuisine-libre\.org$/i, parser: cuisineLibreFallback },
  { hostPattern: /(^|\.)cuisineaz\.com$/i, parser: cuisineAzFallback },
  { hostPattern: /(^|\.)papillesetpupilles\.fr$/i, parser: papillesEtPupillesFallback },
  { hostPattern: /(^|\.)cuisineactuelle\.fr$/i, parser: cuisineActuelleFallback },
];

export function selectDomainParser(sourceUrl: string): DomainParser | null {
  try {
    const host = new URL(sourceUrl).hostname;
    return DOMAIN_PARSERS.find(({ hostPattern }) => hostPattern.test(host))?.parser ?? null;
  } catch {
    return null;
  }
}

export function hasKnownDomain(sourceUrl: string) {
  return Boolean(selectDomainParser(sourceUrl));
}
