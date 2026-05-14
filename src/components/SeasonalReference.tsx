import { CalendarDays } from "lucide-react";
import { MONTH_NAMES, SEASONAL_SOURCE_URL, seasonalCalendar } from "../seasonal";

export function SeasonalReference() {
  const monthIndex = new Date().getMonth();
  const month = seasonalCalendar[monthIndex];

  return (
    <div className="seasonal-reference">
      <div className="label-with-icon">
        <CalendarDays size={20} />
        <strong>Ingrédients de saison en {MONTH_NAMES[monthIndex]}</strong>
      </div>
      <p>{[...month.fruitsLegumes, ...month.poissonsFruitsDeMer].join(", ")}</p>
      <a href={SEASONAL_SOURCE_URL}>Source : Manger Bouger</a>
    </div>
  );
}
