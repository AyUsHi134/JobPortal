// Generic helpers shared by the classification modules. Nothing here is
// specific to tech-relevance vs. experience-level — both need the same
// safe text handling and pattern matching.

export function safeLower(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function matchesAny(text, patterns) {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
}

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns {min, max} for the first recognizable "N-M years" / "N to M
// years" / "N+ years" pattern found in text, or null if none found.
// `max` is null for an open-ended "N+ years" pattern. Deliberately only
// recognizes explicit numeric ranges — never guesses a range from vaguer
// language.
export function extractYearsRange(text) {
  if (!text) return null;

  const rangeMatch = text.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\+?\s*years?\b/i);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }

  const toMatch = text.match(/\b(\d{1,2})\s+to\s+(\d{1,2})\s*\+?\s*years?\b/i);
  if (toMatch) {
    return { min: Number(toMatch[1]), max: Number(toMatch[2]) };
  }

  const plusMatch = text.match(/\b(\d{1,2})\s*\+\s*years?\b/i);
  if (plusMatch) {
    return { min: Number(plusMatch[1]), max: null };
  }

  return null;
}
