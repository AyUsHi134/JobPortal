// Pure homepage search logic

export const EMPTY_SEARCH_MESSAGE = "Enter a job title, skill, or keyword to search.";

/** Validates trimmed query */
export function validateSearchQuery(rawQuery) {
  const trimmed = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!trimmed) {
    return { valid: false, query: "", message: EMPTY_SEARCH_MESSAGE };
  }
  return { valid: true, query: trimmed, message: null };
}

/** Builds encoded search URL */
export function buildJobSearchPath(query) {
  return `/jobs?q=${encodeURIComponent(query)}`;
}
