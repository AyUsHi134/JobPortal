import axios from "axios";
import { success, failure, adapterError } from "./adapterResult.js";

const SOURCE = "adzuna";
const BASE_URL = "https://api.adzuna.com/v1/api/jobs";

// Confirmed live during Phase 1A.5 (ADZUNA_LIVE_TEST.md): requesting more
// than 50 results_per_page is silently capped by Adzuna itself. Clamping
// here just makes that limit explicit to the caller instead of surprising.
const MAX_RESULTS_PER_PAGE = 50;
const DEFAULT_RESULTS_PER_PAGE = 20;
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Fetch one page of raw Adzuna job search results. Returns raw Adzuna job
 * objects exactly as the API sends them — no field renaming, no
 * normalization, no tech/experience classification.
 *
 * @param {object} [options]
 * @param {string} [options.country="in"]   Adzuna country code.
 * @param {string} [options.what]            Keyword search (e.g. "software developer").
 * @param {number} [options.page=1]          1-indexed page number.
 * @param {number} [options.results_per_page=20]  Clamped to 50 (see above).
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<{ok:boolean, source:string, jobs:object[], meta:object, error:object|null, fetchedAt:Date}>}
 */
export async function fetchAdzunaJobs(options = {}) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return failure(
      SOURCE,
      adapterError(
        "missing_credentials",
        "ADZUNA_APP_ID and/or ADZUNA_APP_KEY are not set in the environment."
      )
    );
  }

  const country = options.country || "in";
  const page = options.page || 1;
  const requestedPerPage = options.results_per_page || DEFAULT_RESULTS_PER_PAGE;
  const resultsPerPage = Math.min(requestedPerPage, MAX_RESULTS_PER_PAGE);
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const params = {
    app_id: appId,
    app_key: appKey,
    results_per_page: resultsPerPage,
    "content-type": "application/json",
  };
  if (options.what) params.what = options.what;

  let response;
  try {
    response = await axios.get(`${BASE_URL}/${country}/search/${page}`, {
      params,
      timeout: timeoutMs,
    });
  } catch (err) {
    return failure(SOURCE, classifyAxiosError(err));
  }

  const data = response.data;
  if (!data || !Array.isArray(data.results)) {
    return failure(
      SOURCE,
      adapterError(
        "malformed_response",
        "Adzuna response did not contain a `results` array in the expected shape.",
        { status: response.status }
      )
    );
  }

  return success(SOURCE, data.results, {
    country,
    what: options.what || null,
    page,
    requested_results_per_page: requestedPerPage,
    results_per_page: resultsPerPage,
    results_returned: data.results.length,
    // Adzuna's own reported total match count for this query.
    count: typeof data.count === "number" ? data.count : null,
  });
}

// Deliberately never reads err.config or err.request — both would contain
// the full request URL, and therefore app_id/app_key, in query-string form.
function classifyAxiosError(err) {
  if (err.response) {
    const status = err.response.status;
    if (status === 401 || status === 403) {
      return adapterError(
        "auth_failed",
        "Adzuna rejected the provided credentials.",
        { status, body: safeErrorBody(err.response.data) }
      );
    }
    return adapterError(
      "http_error",
      `Adzuna returned an unexpected HTTP status.`,
      { status, body: safeErrorBody(err.response.data) }
    );
  }
  if (err.code === "ECONNABORTED" || /timeout/i.test(err.message || "")) {
    return adapterError("timeout", "Request to Adzuna timed out.");
  }
  return adapterError(
    "network_error",
    "Network error while contacting Adzuna.",
    { code: err.code || null }
  );
}

// Adzuna's own error bodies (confirmed live in ADZUNA_LIVE_TEST.md) never
// echo credentials back, but keep this defensive and small regardless.
function safeErrorBody(body) {
  if (!body || typeof body !== "object") return null;
  const { display, exception } = body;
  return { display: display || null, exception: exception || null };
}
