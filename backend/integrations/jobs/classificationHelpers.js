// Shared classification helpers

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

// Parses years-of-experience range
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
