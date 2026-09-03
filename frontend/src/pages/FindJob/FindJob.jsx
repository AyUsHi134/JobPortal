import React, { useEffect, useReducer, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JobCard from "../../components/JobCard/JobCard";
import { listJobs } from "../../services/jobsApi.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import {
  DEFAULT_DISCOVERY_FILTERS,
  INITIAL_DISCOVERY_STATE,
  discoveryReducer,
  applyFilterChange,
  applyPageChange,
  resetFilters as buildResetFilters,
  canGoPrev,
  canGoNext,
  searchParamsToFilters,
  filtersToSearchParams,
} from "../../utils/jobDiscoveryState.js";
import "./FindJob.scss";

// Phase 2C: the real Job Discovery page — search, filters, sorting, and
// server-side pagination against GET /api/jobs, replacing the old
// "fetch everything once, filter the in-memory array" pattern
// (FRONTEND_AUDIT.md §6/§14). All the actual state-transition rules
// (reset-to-page-1-on-filter-change, preserve-filters-on-page-change,
// the loading/success/error state machine, URL <-> filters conversion)
// live in utils/jobDiscoveryState.js as plain, independently-tested
// functions — this component only wires them to React state and JSX.
export default function FindJob() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read the initial filter state from the URL exactly once, so a
  // shared/refreshed search link reproduces the same query. See
  // utils/jobDiscoveryState.js's header comment for why this is
  // one-directional (filters -> URL) rather than a full two-way binding.
  const [filters, setFilters] = useState(() => searchParamsToFilters(Object.fromEntries(searchParams)));
  const [searchInput, setSearchInput] = useState(filters.q);
  const [locationInput, setLocationInput] = useState(filters.location);
  const [state, dispatch] = useReducer(discoveryReducer, INITIAL_DISCOVERY_STATE);

  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const debouncedLocation = useDebouncedValue(locationInput, 400);

  // Free-text inputs are debounced before they become part of `filters`
  // (and therefore before they trigger a request) — see
  // hooks/useDebouncedValue.js for why. Discrete controls (the <select>s
  // below) update `filters` immediately on change instead.
  useEffect(() => {
    setFilters((prev) => (prev.q === debouncedSearch ? prev : applyFilterChange(prev, { q: debouncedSearch })));
  }, [debouncedSearch]);

  useEffect(() => {
    setFilters((prev) => (prev.location === debouncedLocation ? prev : applyFilterChange(prev, { location: debouncedLocation })));
  }, [debouncedLocation]);

  // The single fetch effect: any change to `filters` (search settling,
  // a filter/sort selection, or a page change) triggers exactly one
  // request. Cancellation guards against a slow earlier request
  // resolving after a newer one has already started.
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FETCH_START" });
    listJobs(filters)
      .then(({ jobs, pagination }) => {
        if (cancelled) return;
        dispatch({ type: "FETCH_SUCCESS", jobs, pagination });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: "FETCH_ERROR", error: err.message || "Failed to load jobs." });
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // Keep the URL in sync so the current search is shareable/refreshable.
  // `replace: true` avoids piling up a browser-history entry per
  // keystroke/filter click.
  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const updateFilter = (key, value) => setFilters((prev) => applyFilterChange(prev, { [key]: value }));

  const handleReset = () => {
    setSearchInput("");
    setLocationInput("");
    setFilters(buildResetFilters());
  };

  // Phase 2G-7B: "Clear Search" (the no-results state's own action, §below)
  // clears only the text query — reusing the same applyFilterChange rule
  // every other filter already goes through, never a second/duplicated
  // state-transition path — so a user who typed the wrong keyword but had
  // a filter (e.g. Experience: Senior) selected on purpose doesn't lose
  // it. "Browse All Jobs" reuses the existing full handleReset above.
  const handleClearSearch = () => {
    setSearchInput("");
    setFilters((prev) => applyFilterChange(prev, { q: "" }));
  };

  const handlePrevPage = () => {
    if (!canGoPrev(state.pagination)) return;
    setFilters((prev) => applyPageChange(prev, prev.page - 1));
  };

  const handleNextPage = () => {
    if (!canGoNext(state.pagination)) return;
    setFilters((prev) => applyPageChange(prev, prev.page + 1));
  };

  const isDefaultFilters = JSON.stringify(filters) === JSON.stringify(DEFAULT_DISCOVERY_FILTERS);

  return (
    <div className="findjob-page">
      {/* Navbar + Search merged into one continuous white top shell (no
          sage gap between them, matching Home.jsx's same treatment): this
          full-bleed band sits directly under the navbar (whose own
          border-bottom already supplies the "still visually
          distinguishable" divider — untouched in Navbar.scss). Every
          input/select below is the exact same debounced/state-backed
          control this page always had; only the outer wrapper changed. */}
      <div className="findjob-topbar">
        <form className="findjob-toolbar" onSubmit={(e) => e.preventDefault()}>
          <div className="toolbar-field toolbar-field--search">
            <input
              type="text"
              placeholder="Search title, company, description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search jobs"
            />
          </div>

          <div className="toolbar-field">
            <input
              type="text"
              placeholder="Location"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              aria-label="Filter by location"
            />
          </div>

          <div className="toolbar-field">
            <select
              value={filters.is_remote}
              onChange={(e) => updateFilter("is_remote", e.target.value)}
              aria-label="Filter by work mode"
            >
              <option value="">Work mode</option>
              <option value="true">Remote</option>
              <option value="false">On-site</option>
            </select>
          </div>

          <div className="toolbar-field">
            <select
              value={filters.experience_level}
              onChange={(e) => updateFilter("experience_level", e.target.value)}
              aria-label="Filter by experience level"
            >
              <option value="">Experience</option>
              <option value="fresher">Fresher</option>
              <option value="entry">Entry level</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid level</option>
              <option value="senior">Senior</option>
              <option value="unknown">Unclassified</option>
            </select>
          </div>

          <button type="submit" className="toolbar-search-btn">
            Search
          </button>
        </form>
      </div>

      {/* Two-column dashboard area (SS2 composition): the LEFT column now
          carries the compact green "Find Jobs" intro card stacked directly
          above the existing Filters panel; the RIGHT/main column is the
          job-listings heading + real job-card grid, unchanged in behavior. */}
      <div className="findjob-container">
        <aside className="findjob-sidebar">
          <div className="findjob-sidebar__intro">
            <h1>Find Jobs</h1>
            <p>Search real, live opportunities and find the right fit.</p>
          </div>

          <div className="filters">
            <h3>Filters</h3>

            <label className="filter-label">
              Technology relevance
              <select value={filters.is_tech_relevant} onChange={(e) => updateFilter("is_tech_relevant", e.target.value)}>
                <option value="">All jobs</option>
                <option value="true">Tech-relevant</option>
                <option value="false">Non-tech</option>
              </select>
            </label>

            <label className="filter-label">
              Source
              <select value={filters.source} onChange={(e) => updateFilter("source", e.target.value)}>
                <option value="">All sources</option>
                <option value="adzuna">Adzuna</option>
                <option value="remoteok">RemoteOK</option>
              </select>
            </label>

            <label className="filter-label">
              Language
              <select value={filters.language} onChange={(e) => updateFilter("language", e.target.value)}>
                <option value="en">English</option>
                <option value="other">Other languages</option>
                <option value="all">All languages</option>
              </select>
            </label>

            <label className="filter-label">
              Sort by
              <select value={filters.sort} onChange={(e) => updateFilter("sort", e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="salary_high">Highest salary first</option>
              </select>
            </label>
            {filters.sort === "salary_high" && (
              <p className="filter-hint">
                Note: most listings don't currently include a salary figure — jobs without one still appear, sorted last.
              </p>
            )}

            <button type="button" className="reset-btn" onClick={handleReset} disabled={isDefaultFilters}>
              Reset filters
            </button>
          </div>
        </aside>

        <section className="job-listings">
          <h2>All Jobs</h2>

        {state.status === "loading" && <p className="status-message" role="status" aria-live="polite">Loading jobs...</p>}

        {state.status === "error" && (
          <p className="status-message status-error" role="alert">{state.error}</p>
        )}

        {state.status === "success" && state.jobs.length === 0 && (
          isDefaultFilters ? (
            <p className="status-message" role="status">No active jobs are available right now.</p>
          ) : (
            <div className="status-message no-results" role="status">
              <p className="no-results__title">No jobs found</p>
              <p className="no-results__body">
                {filters.q
                  ? <>We couldn't find jobs matching &quot;{filters.q}&quot;.</>
                  : "No jobs match your current filters."}
                {" "}Try another keyword or clear your search.
              </p>
              <div className="no-results__actions">
                {filters.q && (
                  <button type="button" className="no-results__btn" onClick={handleClearSearch}>
                    Clear Search
                  </button>
                )}
                <button type="button" className="no-results__btn no-results__btn--primary" onClick={handleReset}>
                  Browse All Jobs
                </button>
              </div>
            </div>
          )
        )}

        {state.status === "success" && state.jobs.length > 0 && (
          <>
            <p className="results-count" aria-live="polite">
              Showing {state.jobs.length} of {state.pagination.total} job{state.pagination.total === 1 ? "" : "s"}
            </p>
            <div className="job-listings__grid">
              {state.jobs.map((job) => (
                <JobCard job={job} key={job._id} />
              ))}
            </div>

            {state.pagination.totalPages > 1 && (
              <div className="pagination">
                <button type="button" onClick={handlePrevPage} disabled={!canGoPrev(state.pagination)}>
                  Previous
                </button>
                <span className="pagination-status" aria-live="polite">
                  Page {state.pagination.page} of {state.pagination.totalPages} ({state.pagination.total} jobs)
                </span>
                <button type="button" onClick={handleNextPage} disabled={!canGoNext(state.pagination)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
        </section>
      </div>
    </div>
  );
}
