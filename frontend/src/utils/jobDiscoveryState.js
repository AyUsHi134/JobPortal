// Pure state-transition logic for the Job Discovery page (FindJob.jsx).
// Kept separate from the component and framework-free (no React import)
// so the actual rules — "changing a filter resets to page 1," "changing
// only the page preserves every other filter," "never request beyond the
// known last page," the fetch-status state machine, and URL query-param
// <-> filters conversion — are all directly unit-testable without
// rendering a component (see src/tests/testJobDiscovery.js,
// testJobFilters.js, testJobPagination.js). FindJob.jsx wires these to
// useState/useReducer/useSearchParams but contains no branching logic of
// its own beyond calling these.

export const DEFAULT_DISCOVERY_FILTERS = {
  q: "",
  experience_level: "",
  is_tech_relevant: "",
  is_remote: "",
  location: "",
  source: "",
  language: "en",
  sort: "newest",
  page: 1,
};

// Every filter/search/sort field always resets pagination to page 1 —
// per this phase's explicit requirement ("When search/filter parameters
// change, reset pagination to page 1"). `changes` may include a `page`
// key itself (e.g. a caller resetting everything at once); if so, it's
// respected as given rather than silently forced back to 1.
export function applyFilterChange(currentFilters, changes) {
  return { ...currentFilters, ...changes, page: changes.page ?? 1 };
}

// A page navigation (Prev/Next/direct) preserves every other filter —
// only `page` changes.
export function applyPageChange(currentFilters, page) {
  return { ...currentFilters, page };
}

export function resetFilters() {
  return { ...DEFAULT_DISCOVERY_FILTERS };
}

// --- Pagination bounds -------------------------------------------------

const EMPTY_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

export function canGoPrev(pagination) {
  return Boolean(pagination) && pagination.page > 1;
}

export function canGoNext(pagination) {
  return Boolean(pagination) && pagination.totalPages > 0 && pagination.page < pagination.totalPages;
}

// Guards against ever requesting a page outside the known range — used
// by direct page-number entry points (not needed for Prev/Next, which
// are already disabled via canGoPrev/canGoNext, but direct navigation —
// e.g. a manually-edited URL — needs its own check). `totalPages: 0`
// (no results at all) safely collapses to "only page 1 is valid."
export function isValidPageTarget(page, pagination) {
  if (!Number.isInteger(page) || page < 1) return false;
  const totalPages = pagination?.totalPages ?? 0;
  if (totalPages <= 0) return page === 1;
  return page <= totalPages;
}

// --- Fetch-status state machine ----------------------------------------
//
// A plain reducer (no React) so "while loading, the previous page's jobs
// are never presented as the current query's results" is a property of
// this function's own logic, not just a rendering convention scattered
// across JSX. FindJob.jsx renders the job grid ONLY when status is
// "success" (and pagination/error text otherwise), so a stale `jobs`
// array sitting in state during "loading" is simply never shown.

export const INITIAL_DISCOVERY_STATE = {
  status: "idle", // idle | loading | success | error
  jobs: [],
  pagination: EMPTY_PAGINATION,
  error: null,
};

export function discoveryReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, status: "loading", error: null };
    case "FETCH_SUCCESS":
      return { ...state, status: "success", jobs: action.jobs, pagination: action.pagination, error: null };
    case "FETCH_ERROR":
      // Deliberately keeps the previous `jobs`/`pagination` in state (in
      // case a caller wants them later) but the component never renders
      // them while status is "error" — only the safe error message.
      return { ...state, status: "error", error: action.error };
    default:
      return state;
  }
}

// --- URL <-> filters synchronization ------------------------------------
//
// One-directional (filters -> URL) by design for this phase: the initial
// filters are read from the URL once on mount, and every subsequent
// filter change is written back to the URL, so a search can be shared or
// refreshed. Browser back/forward navigation changes the URL without
// this module re-parsing it back into component state — a deliberate,
// disclosed scope boundary (see PHASE_2C_REPORT.md §7) rather than a
// full two-way binding, which would need additional loop-prevention
// engineering disproportionate to this phase.

const NUMERIC_FILTER_KEYS = new Set(["page"]);

/** `searchParamsObject` is a plain object, e.g. `Object.fromEntries(searchParams)`. */
export function searchParamsToFilters(searchParamsObject) {
  const filters = { ...DEFAULT_DISCOVERY_FILTERS };
  for (const key of Object.keys(DEFAULT_DISCOVERY_FILTERS)) {
    const raw = searchParamsObject?.[key];
    if (raw === undefined || raw === "") continue;
    if (NUMERIC_FILTER_KEYS.has(key)) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isInteger(parsed) && parsed > 0) filters[key] = parsed;
    } else {
      filters[key] = raw;
    }
  }
  return filters;
}

/** Returns a plain object suitable for react-router's `setSearchParams()` — omits default/empty values so the URL stays clean. */
export function filtersToSearchParams(filters) {
  const params = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_DISCOVERY_FILTERS)) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    if (value === defaultValue) continue;
    params[key] = String(value);
  }
  return params;
}
