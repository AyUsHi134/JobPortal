import React, { useEffect, useReducer, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JobCard from "../../components/JobCard/JobCard";
import GuestSignupCta from "../../components/GuestSignupCta/GuestSignupCta";
import { listJobs } from "../../services/jobsApi.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { useGuestJobLimit } from "../../hooks/useGuestJobLimit.js";
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

// Job discovery page, server-side filtering
export default function FindJob() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { guestLimitReached, recordJobsResponse } = useGuestJobLimit();

  // Read initial filters from URL
  const [filters, setFilters] = useState(() => searchParamsToFilters(Object.fromEntries(searchParams)));
  const [searchInput, setSearchInput] = useState(filters.q);
  const [locationInput, setLocationInput] = useState(filters.location);
  const [state, dispatch] = useReducer(discoveryReducer, INITIAL_DISCOVERY_STATE);

  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const debouncedLocation = useDebouncedValue(locationInput, 400);

  // Text inputs debounced; selects immediate
  useEffect(() => {
    setFilters((prev) => (prev.q === debouncedSearch ? prev : applyFilterChange(prev, { q: debouncedSearch })));
  }, [debouncedSearch]);

  useEffect(() => {
    setFilters((prev) => (prev.location === debouncedLocation ? prev : applyFilterChange(prev, { location: debouncedLocation })));
  }, [debouncedLocation]);

  // Single fetch effect with cancellation
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FETCH_START" });
    listJobs(filters)
      .then((response) => {
        if (cancelled) return;
        dispatch({ type: "FETCH_SUCCESS", jobs: response.jobs, pagination: response.pagination });
        recordJobsResponse(response);
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: "FETCH_ERROR", error: err.message || "Failed to load jobs." });
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // Sync URL, replace history
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

  // Clear Search keeps other filters
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
      {/* Merged navbar and search shell */}
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

      {/* Two-column dashboard layout */}
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
                <button type="button" onClick={handleNextPage} disabled={!canGoNext(state.pagination) || guestLimitReached}>
                  Next
                </button>
              </div>
            )}

            {/* Guest limit panel */}
            {guestLimitReached && <GuestSignupCta />}
          </>
        )}
        </section>
      </div>
    </div>
  );
}
