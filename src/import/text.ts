const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  copy: "(c)",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ugrave: "ù",
  ucirc: "û",
  ccedil: "ç",
  nbsp: " ",
  quot: '"',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "-",
  frac12: "1/2",
};

function repairMojibake(value: string) {
  if (!/[ÃÂâï¿\u0019]/.test(value)) return value;
  const cp1252Map: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  const toCp1252Byte = (char: string) => {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) return code;
    return cp1252Map[code] ?? 0x3f;
  };

  try {
    const bytes = Uint8Array.from(Array.from(value, toCp1252Byte));
    const repaired = new TextDecoder("utf-8").decode(bytes);
    const originalNoise = (value.match(/[ÃÂâï¿\u0019]/g) ?? []).length;
    const repairedNoise = (repaired.match(/[ÃÂâï¿\u0019]/g) ?? []).length;
    return repairedNoise < originalNoise ? repaired : value;
  } catch {
    return value;
  }
}

export function decodeHtmlEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
      const key = code.toLowerCase();
      if (key.startsWith("#x")) {
        const character = Number.parseInt(key.slice(2), 16);
        return Number.isFinite(character) ? String.fromCodePoint(character) : entity;
      }
      if (key.startsWith("#")) {
        const character = Number.parseInt(key.slice(1), 10);
        return Number.isFinite(character) ? String.fromCodePoint(character) : entity;
      }
      return HTML_ENTITIES[key] ?? entity;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function cleanText(value: unknown) {
  if (value == null) return "";
  return stripWrappingQuotes(
    repairMojibake(decodeHtmlEntities(String(value)))
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
    ["«", "»"],
    ["â€œ", "â€\u009d"],
    ["â€˜", "â€™"],
    ["Â«", "Â»"],
  ];
  for (const [start, end] of pairs) {
    if (
      trimmed.startsWith(start) &&
      trimmed.endsWith(end) &&
      trimmed.length >= start.length + end.length
    ) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim();
    }
  }
  return trimmed;
}

export function isImageMarkdownLine(value: string) {
  return /^!?\[.*image/i.test(value);
}

export function isInstructionNoise(value: string) {
  return (
    !value ||
    /^https?:\/\//i.test(value) ||
    isImageMarkdownLine(value) ||
    /^\*+\s*\*+$/.test(value.trim()) ||
    /value=|formulaire_action|jQuery|autosave|_gaq|trackingParams|commandMetadata|navigationEndpoint/i.test(
      value
    )
  );
}
