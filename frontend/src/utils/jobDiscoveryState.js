// Pure discovery state transitions

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

// Filter change resets page
export function applyFilterChange(currentFilters, changes) {
  return { ...currentFilters, ...changes, page: changes.page ?? 1 };
}

// Page change preserves filters
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

// Guards page range
export function isValidPageTarget(page, pagination) {
  if (!Number.isInteger(page) || page < 1) return false;
  const totalPages = pagination?.totalPages ?? 0;
  if (totalPages <= 0) return page === 1;
  return page <= totalPages;
}

// Fetch-status state machine

export const INITIAL_DISCOVERY_STATE = {
  status: "idle", // Status values
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
      // Keeps previous data, never rendered
      return { ...state, status: "error", error: action.error };
    default:
      return state;
  }
}

// URL and filters synchronization

const NUMERIC_FILTER_KEYS = new Set(["page"]);

/** Plain object of search params */
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

/** Returns clean params object */
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
