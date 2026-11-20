export function isLikelyRecipeImage(url?: string) {
  if (!url) return false;
  if (/\/IMG\/groupeon\d+\.png/i.test(url)) return false;
  if (/\/moton\d+/i.test(url)) return false;
  if (/logo|sprite|icon|avatar|placeholder|default-image|social|banner|favicon/i.test(url))
    return false;
  if (/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) return false;
  if (/_h(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) return false;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w100\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url))
    return false;
  return (
    /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url) || /local\/cache-(?:gd2|vignettes)\//i.test(url)
  );
}

function imageCandidateScore(url: string) {
  let score = 0;
  if (/recette|recipe|food|plat|dish|cooking|\/photos?\//i.test(url)) score += 5;
  if (/\/uploads\/|\/wp-content\/|\/media\/|\/images?\//i.test(url)) score += 2;
  if (/logo|sprite|icon|avatar|placeholder|default-image|social|banner|favicon/i.test(url))
    score -= 8;
  if (/\/IMG\/groupeon\d+\.png|\/moton\d+/i.test(url)) score -= 8;
  if (/_w(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 10;
  if (/_h(?:[1-9]?\d|[1-3]\d\d)\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score -= 10;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w100\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url))
    score -= 12;
  if (/assets\.afcdn\.com\/recipe\/\d+\/\d+_w200\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url))
    score -= 14;
  if (/_w(?:[6-9]\d\d|[1-9]\d{3,})\./i.test(url)) score += 3;
  if (/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) score += 1;
  return score;
}

export function pickBestImageCandidate(candidates: Array<string | undefined>, sourceUrl: string) {
  const absolutes = candidates
    .filter(Boolean)
    .map((value) => absolutizeUrl(value, sourceUrl))
    .filter((value): value is string => Boolean(value));
  if (absolutes.length === 0) return undefined;
  const best = [...absolutes].sort((a, b) => imageCandidateScore(b) - imageCandidateScore(a))[0];
  if (isLikelyRecipeImage(best)) return best;
  const likely = absolutes.find((url) => isLikelyRecipeImage(url));
  return likely ?? best;
}

export function absolutizeUrl(value: string | undefined, baseUrl: string) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) {
    try {
      const { protocol } = new URL(baseUrl);
      return `${protocol}${trimmed}`;
    } catch {
      return `https:${trimmed}`;
    }
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}
