// Pure, framework-free logic for the Phase 2G-3 homepage hero search.
// The homepage search box never calls the jobs API and never duplicates
// FindJob.jsx's real backend-side search (Phase 2C) — its only job is to
// decide whether a typed query is meaningful, and if so, build the
// `/jobs?q=...` URL that hands off to the real Job Discovery page. Kept
// side-effect-free so the validation decision is directly unit-testable,
// mirroring the established pattern in utils/jobDiscoveryState.js and
// utils/savedJobUi.js.

export const EMPTY_SEARCH_MESSAGE = "Enter a job title, skill, or keyword to search.";

/**
 * A query is only meaningful once whitespace is trimmed away — a
 * whitespace-only or empty input must never reach the jobs API (there is
 * nothing real to search for). Returns the trimmed query on success so
 * the caller never has to re-trim, and never invents a message for the
 * success case (`message: null`).
 */
export function validateSearchQuery(rawQuery) {
  const trimmed = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!trimmed) {
    return { valid: false, query: "", message: EMPTY_SEARCH_MESSAGE };
  }
  return { valid: true, query: trimmed, message: null };
}

/**
 * Builds the exact path FindJob.jsx's own URL <-> filters conversion
 * (utils/jobDiscoveryState.js#searchParamsToFilters) already knows how to
 * read on mount — the query is percent-encoded so special characters
 * (`&`, `?`, `#`, non-ASCII text) can never corrupt the URL or leak an
 * unintended second query parameter.
 */
export function buildJobSearchPath(query) {
  return `/jobs?q=${encodeURIComponent(query)}`;
}
