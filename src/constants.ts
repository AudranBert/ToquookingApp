import type { SeasonalThreshold } from "./types";

export const SEASONAL_THRESHOLDS: readonly SeasonalThreshold[] = [0, 1, 3];

export const SEASONAL_THRESHOLD_LABELS: Record<SeasonalThreshold, string> = {
  0: "Toutes les recettes",
  1: "Au moins 1",
  3: "Au moins 3",
};
