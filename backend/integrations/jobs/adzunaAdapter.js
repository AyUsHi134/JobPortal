import axios from "axios";
import { success, failure, adapterError } from "./adapterResult.js";

const SOURCE = "adzuna";
const BASE_URL = "https://api.adzuna.com/v1/api/jobs";

// Adzuna caps results at 50
const MAX_RESULTS_PER_PAGE = 50;
const DEFAULT_RESULTS_PER_PAGE = 20;
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Fetch raw Adzuna jobs page
 * @param {object} [options]
 * @param {string} [options.country="in"] Adzuna country code
 * @param {string} [options.what] Keyword search
 * @param {number} [options.page=1] Page number
 * @param {number} [options.results_per_page=20] Clamped to 50
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
    // Adzuna's reported total matches
    count: typeof data.count === "number" ? data.count : null,
  });
}

// Never read request URL (secrets)
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

// Defensive, keep error small
function safeErrorBody(body) {
  if (!body || typeof body !== "object") return null;
  const { display, exception } = body;
  return { display: display || null, exception: exception || null };
}
