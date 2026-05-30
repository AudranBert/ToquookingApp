import type { CSSProperties } from "react";
import type { RecipeTag } from "../types";

export function buildTagColorMap(tags: RecipeTag[]) {
  const map = new Map<string, string>();
  tags.forEach((tag) => {
    const color = tag.color?.trim();
    if (color) map.set(tag.name.toLowerCase(), color);
  });
  return map;
}

export function getTagStyle(tagName: string, tagColorByName?: Map<string, string>, fallbackColor?: string): CSSProperties | undefined {
  const color = fallbackColor ?? tagColorByName?.get(tagName.toLowerCase());
  if (!color) return undefined;
  return { background: color, borderColor: color, color: "var(--chip-text-on-color)" };
}
