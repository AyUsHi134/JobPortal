/**
 * Phase 1H-3 reliability helper: a small, bounded, backoff-based retry
 * wrapper for a source adapter's `fetch` function.
 *
 * This module contains NO source-specific HTTP handling and NO
 * knowledge of Adzuna/RemoteOK — it only wraps whatever adapter fetch
 * function it's given, and only retries when that function's own
 * returned error looks transient, per Phase 1D's documented
 * adapterResult.js error.type convention (missing_credentials |
 * auth_failed | http_error | timeout | network_error |
 * malformed_response — see PHASE_1D_REPORT.md §6). It never modifies an
 * adapter file and never changes what a successful/failed adapter
 * result looks like beyond adding a small `meta.attempts` count.
 */

// Only genuinely transient conditions are retried. Deliberately
// excluded: `missing_credentials` and `auth_failed` (retrying won't fix
// a bad/missing key — it would just burn additional quota for the same
// guaranteed outcome), and `malformed_response` (the source sent a body
// that doesn't match the expected shape "right now" — a structural
// problem, not a transient blip; retrying immediately is very unlikely
// to get a different body and risks being mistaken for scraping abuse).
const RETRYABLE_ERROR_TYPES = new Set(["timeout", "network_error"]);

// A 5xx from the source is the server's own transient condition — worth
// one bounded retry. A 4xx (bad request, not-found, etc., aside from the
// 401/403 already classified as auth_failed by the adapters) reflects
// something about the request itself that a bare retry cannot fix.
function isRetryableError(error) {
  if (!error || typeof error !== "object") return false;
  if (RETRYABLE_ERROR_TYPES.has(error.type)) return true;
  if (error.type === "http_error" && typeof error.status === "number" && error.status >= 500) {
    return true;
  }
  return false;
}

// Deliberately small: at most one retry beyond the original attempt.
// Adzuna's free tier is reported at ~33 calls/day (JOB_API_DATA_REPORT.md)
// and each ingestion run already makes at most one call per source
// (PHASE_1H1_REPORT.md §11) — doubling that in the rare transient-failure
// case is a safe, bounded cost; anything more aggressive risks consuming
// meaningful quota for a source that's likely still down anyway.
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 500;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a source adapter's fetch function (Phase 1D's
 * success()/failure() convention) with a small bounded retry for
 * transient failures only.
 *
 * - A successful (`ok: true`) result is returned immediately, no retry.
 * - A non-transient failure (bad credentials, malformed response, a 4xx)
 *   is returned immediately, no retry — retrying it would not change
 *   the outcome.
 * - A transient failure is retried up to `maxAttempts - 1` additional
 *   times, with exponential backoff (`baseDelayMs * 2^(attempt-1)`)
 *   between attempts, so a burst of transient failures doesn't
 *   immediately re-hammer a free-tier API.
 * - The final returned result always carries `meta.attempts` (merged
 *   into whatever `meta` the adapter itself returned) recording exactly
 *   how many attempts were made — visible in the orchestrator's
 *   per-source `meta` field and therefore in logs/run results, without
 *   inventing a new top-level concept.
 *
 * @param {Function} fetchFn - an adapter's fetch function, e.g. fetchAdzunaJobs
 * @param {object} [options]
 * @param {number} [options.maxAttempts=2]
 * @param {number} [options.baseDelayMs=500]
 * @param {Function} [options.sleep] - injectable for deterministic tests
 *   (defaults to a real setTimeout-based delay); tests pass a no-op or
 *   instrumented stand-in so retry backoff never actually waits in a
 *   test run.
 */
export function withRetry(fetchFn, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  return async function fetchWithRetry(...args) {
    let lastResult;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      lastResult = await fetchFn(...args);

      if (lastResult && lastResult.ok) break;
      if (!isRetryableError(lastResult && lastResult.error)) break;
      if (attempt === maxAttempts) break;

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }

    return {
      ...lastResult,
      meta: { ...(lastResult && lastResult.meta), attempts },
    };
  };
}

export { isRetryableError, RETRYABLE_ERROR_TYPES, DEFAULT_MAX_ATTEMPTS, DEFAULT_BASE_DELAY_MS };
