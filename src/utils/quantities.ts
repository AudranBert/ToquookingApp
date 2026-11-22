const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

/** Only exact quantities can be scaled; ranges and prose remain unchanged. */
export function parseQuantity(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim().replace(",", ".").replace(/⁄/g, "/");
  const unicode = text.match(/^(\d+)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/u);
  if (unicode) return Number(unicode[1] ?? 0) + UNICODE_FRACTIONS[unicode[2]];
  const fraction = text.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[3]);
    return denominator ? Number(fraction[1] ?? 0) + Number(fraction[2]) / denominator : undefined;
  }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return undefined;
  const result = Number(text);
  return Number.isFinite(result) ? result : undefined;
}

export function formatQuantity(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const fractions: Array<[number, string]> = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  const whole = Math.floor(rounded);
  const fraction = fractions.find(
    ([candidate]) => Math.abs(candidate - (rounded - whole)) < 0.005
  )?.[1];
  if (fraction) return whole > 0 ? `${whole} ${fraction}` : fraction;
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
