import axios from "axios";
import { success, failure, adapterError } from "./adapterResult.js";

const SOURCE = "remoteok";
const URL = "https://remoteok.com/api";
const DEFAULT_TIMEOUT_MS = 15000;

// Confirmed live in JOB_API_DATA_REPORT.md §3: element 0 of the response
// array is a legal/attribution notice, not a job. It has neither field.
function isLegalNotice(entry) {
  return !entry || (entry.position === undefined && entry.company === undefined);
}

// Same minimal shape check the existing backend/scripts/importRemoteOk.js
// already uses to skip non-job entries — this is basic response-shape
// validation, not tech/experience/content classification.
function looksLikeJob(entry) {
  return Boolean(entry && entry.position && entry.company);
}

/**
 * Fetch the current RemoteOK public job feed. Returns raw RemoteOK job
 * objects exactly as the API sends them — no field renaming, no
 * normalization, and RemoteOK's `tags` are passed through unfiltered
 * (they are NOT a reliable tech/skill classification — see
 * JOB_API_DATA_REPORT.md §3/§8 — that judgment belongs to a later phase).
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<{ok:boolean, source:string, jobs:object[], meta:object, error:object|null, fetchedAt:Date}>}
 */
export async function fetchRemoteOKJobs(options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  let response;
  try {
    response = await axios.get(URL, {
      timeout: timeoutMs,
      headers: {
        // RemoteOK has been reported to reject requests with no User-Agent.
        // Phase 1A's live verification used one; carried forward here.
        "User-Agent": "JobPortal-Adapter/1.0 (+https://github.com/)",
      },
    });
  } catch (err) {
    return failure(SOURCE, classifyAxiosError(err));
  }

  const data = response.data;
  if (!Array.isArray(data)) {
    return failure(
      SOURCE,
      adapterError(
        "malformed_response",
        "RemoteOK response was not the expected flat JSON array.",
        { status: response.status }
      )
    );
  }

  const legalNotice = data.find(isLegalNotice) || null;
  const jobs = data.filter(looksLikeJob);

  return success(SOURCE, jobs, {
    raw_entry_count: data.length,
    job_count: jobs.length,
    skipped_non_job_entries: data.length - jobs.length,
    legal_notice: legalNotice,
  });
}

function classifyAxiosError(err) {
  if (err.response) {
    const status = err.response.status;
    return adapterError("http_error", "RemoteOK returned an unexpected HTTP status.", { status });
  }
  if (err.code === "ECONNABORTED" || /timeout/i.test(err.message || "")) {
    return adapterError("timeout", "Request to RemoteOK timed out.");
  }
  return adapterError("network_error", "Network error while contacting RemoteOK.", {
    code: err.code || null,
  });
}
