// Deterministic, integration-style verification for the Phase 2D Job
// Detail feature as a whole: that a valid id requests the correct
// detail API function and a successful {success,data} response resolves
// into the exact normalized job object, plus the required static
// verifications — internal backend fields are never referenced by the
// rendering components, no unsafe HTML injection, no direct fetch/axios
// calls outside the service layer, the apply link always uses the real
// backend value, loading/404/invalid-id/error states are all wired up,
// back-to-listing navigation exists, and the JobCard -> Detail route is
// consistent (id-only, no whole-object/location-state passing, and no
// duplicate/competing route). No real network call is made; the
// data-flow check uses a mocked axios adapter (same technique as
// testJobsApi.js/testJobDiscovery.js) and the rest read the actual
// source files on disk. Run via `node src/tests/testJobDetails.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

const { apiClient } = await import("../services/api.js");
const { getJobById } = await import("../services/jobsApi.js");
const { jobDetailReducer, getInitialJobDetailState, JOB_DETAIL_STATUS } = await import("../utils/jobDetailState.js");

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}

function mockAdapter({ status = 200, data = {} } = {}, captureConfig) {
  return async (config) => {
    if (captureConfig) captureConfig(config);
    return { data, status, statusText: "", headers: {}, config, request: {} };
  };
}

const REAL_SHAPED_JOB = {
  _id: "6a821b6696420a6830d291e6",
  title: "Backend Developer (Node.js)",
  company: "Brightline Systems Pvt Ltd",
  description: "<p>Build APIs.</p><p>Own the roadmap.</p>",
  apply_link: "https://www.adzuna.in/land/ad/123",
  location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
  salary: { min: null, max: null, currency: null, is_estimated: null },
  job_type: "full_time",
  is_remote: null,
  experience_level: "mid",
  is_tech_relevant: true,
  tech_relevance_source: "source_category",
  source_category: "IT Jobs",
  tags: ["it jobs"],
  normalized_skills: ["node.js", "javascript"],
  logo: "",
  date_posted: "2026-08-10T09:15:00.000Z",
  status: "active",
  source: "adzuna",
  source_id: "5900001234",
};

function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

const JOB_DETAIL_SOURCE = readSource("pages/JobDetail/JobDetail.jsx");
const JOB_DESCRIPTION_SOURCE = readSource("pages/JobDescription/JobDescription.jsx");
const APP_SOURCE = readSource("App.jsx");
const JOB_CARD_SOURCE = readSource("components/JobCard/JobCard.jsx");

console.log("============================");
console.log(" JOB DETAIL PAGE — INTEGRATION & STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] A valid job id requests the correct detail API function (GET /api/jobs/:id) through the service layer");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, data: REAL_SHAPED_JOB } }, (config) => {
    captured = config;
  });

  const job = await getJobById(REAL_SHAPED_JOB._id);

  check("GET method used", captured.method === "get");
  check("the correct path with the id interpolated", captured.url === `/api/jobs/${REAL_SHAPED_JOB._id}`);
  check("job returned matches the mocked job", job._id === REAL_SHAPED_JOB._id);
  check("JobDescription.jsx imports getJobById from services/jobsApi.js (not a raw fetch/axios call)", /getJobById/.test(JOB_DESCRIPTION_SOURCE) && /from ["'].*services\/jobsApi\.js["']/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[2] A successful {success,data} response resolves into a real job that flows into the SUCCESS state unmodified");
{
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, data: REAL_SHAPED_JOB } });
  const job = await getJobById(REAL_SHAPED_JOB._id);
  const state = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_SUCCESS", job });

  check("the caller never has to know about the {success,...} envelope", !("success" in job));
  check("SUCCESS state carries the exact resolved job", state.status === JOB_DETAIL_STATUS.SUCCESS && state.job._id === REAL_SHAPED_JOB._id);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Structured location survives the round trip as a real object, never flattened/stringified early");
{
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, data: REAL_SHAPED_JOB } });
  const job = await getJobById(REAL_SHAPED_JOB._id);
  check("location is still a structured object with city/state/country", typeof job.location === "object" && job.location.city === "Pune" && job.location.country === "India");
}

// ---------------------------------------------------------------------------
console.log("\n[4] JobDetail.jsx never references internal/excluded backend fields (BACKEND_API_CONTRACT.md §2)");
{
  const forbiddenFields = ["hiring_stage", "dedup_fingerprint", "last_seen_at", "expires_at", "createdAt", "updatedAt", "__v"];
  for (const field of forbiddenFields) {
    check(`JobDetail.jsx does not reference "job.${field}"`, !new RegExp(`job\\.${field}\\b`).test(JOB_DETAIL_SOURCE));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[5] No unsafe HTML injection anywhere in the Job Detail rendering path");
{
  check("JobDetail.jsx contains no dangerouslySetInnerHTML", !/dangerouslySetInnerHTML/.test(JOB_DETAIL_SOURCE));
  check("JobDescription.jsx contains no dangerouslySetInnerHTML", !/dangerouslySetInnerHTML/.test(JOB_DESCRIPTION_SOURCE));
  check("JobDetail.jsx renders description via the sanitizing formatter (descriptionToParagraphs), not raw job.description", /descriptionToParagraphs\(job\.description\)/.test(JOB_DETAIL_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[6] No direct fetch/axios calls exist outside the centralized service layer");
{
  for (const [label, source] of [["JobDetail.jsx", JOB_DETAIL_SOURCE], ["JobDescription.jsx", JOB_DESCRIPTION_SOURCE]]) {
    check(`${label} contains no direct fetch(...) call`, !/\bfetch\(/.test(source));
    check(`${label} contains no direct axios usage`, !/\baxios\b/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[7] Apply link always uses the real backend value, never a fabricated URL; a missing/invalid link is handled safely");
{
  check("the Apply action uses job.apply_link verbatim as the href", /href=\{job\.apply_link\}/.test(JOB_DETAIL_SOURCE));
  check("apply_link validity is checked via the shared isValidApplyLink formatter before rendering a link", /isValidApplyLink\(job\.apply_link\)/.test(JOB_DETAIL_SOURCE));
  // Phase 2G-4: the fallback's copy changed from a paragraph reading "No
  // application link is available for this job." to a real disabled
  // <button> reading "Application link unavailable", rendered in the
  // Apply action's own slot (see testJobApply.js for the full behavior
  // this phase added) — this assertion follows that intentional,
  // disclosed copy/markup change rather than the old text.
  check("a missing/invalid apply link renders a safe fallback control instead of a broken/fabricated link", /Application link unavailable/.test(JOB_DETAIL_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Source is rendered when available via the shared formatSource formatter");
{
  check("JobDetail.jsx renders source via formatSource(job.source)", /formatSource\(job\.source\)/.test(JOB_DETAIL_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[9] Skills/tags are handled safely when missing or empty (never crash, never a fabricated placeholder)");
{
  check("normalized_skills is Array-guarded before use", /Array\.isArray\(job\.normalized_skills\)/.test(JOB_DETAIL_SOURCE));
  check("tags is Array-guarded before use", /Array\.isArray\(job\.tags\)/.test(JOB_DETAIL_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[10] A loading state is rendered while the request is pending");
{
  check("JobDescription.jsx branches on the LOADING status", /JOB_DETAIL_STATUS\.LOADING/.test(JOB_DESCRIPTION_SOURCE));
  check("a real loading message is shown, not a blank/undefined render", /Loading job details/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[11] A 404 (job not found / inactive) produces a distinct, user-facing not-found state with a way back to the listing");
{
  check("JobDescription.jsx branches on NOT_FOUND", /JOB_DETAIL_STATUS\.NOT_FOUND/.test(JOB_DESCRIPTION_SOURCE));
  check("a clear 'Job not found' heading is shown", /Job not found/.test(JOB_DESCRIPTION_SOURCE));
  check("a link back to the job listing is present in the not-found state", /to="\/jobs"/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[12] A malformed/invalid id is distinguished from a plain 404 and handled safely (never a raw CastError/stack trace)");
{
  check("JobDescription.jsx branches on INVALID_ID separately from NOT_FOUND", /JOB_DETAIL_STATUS\.INVALID_ID/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[13] A general API/network failure produces a safe error state (the normalized message only, never raw Axios/Mongo internals)");
{
  check("JobDescription.jsx branches on ERROR", /JOB_DETAIL_STATUS\.ERROR/.test(JOB_DESCRIPTION_SOURCE));
  check("the rendered error text comes from the normalized state.message, not a raw error object", /\{state\.message/.test(JOB_DESCRIPTION_SOURCE));
  check("no raw axios/Mongo-shaped text (e.g. 'AxiosError', 'CastError', 'mongodb') is hardcoded into the page", !/AxiosError|CastError|mongodb:\/\//i.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[14] Back-to-listing navigation exists on both the loaded detail view and the error/not-found states");
{
  check("JobDetail.jsx (the loaded view) links back to /jobs", /to="\/jobs"/.test(JOB_DETAIL_SOURCE));
  check("JobDescription.jsx's error/not-found states link back to /jobs", /to="\/jobs"/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[15] The detail page is independently loadable by id alone — no dependency on listing-page state");
{
  check("JobDescription.jsx reads the id via useParams", /useParams/.test(JOB_DESCRIPTION_SOURCE));
  check("JobDescription.jsx does not read React Router location.state (no dependency on FindJob's in-memory state surviving navigation)", !/location\.state|useLocation/.test(JOB_DESCRIPTION_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[16] JobCard -> Detail navigation passes only the job id, never the whole job object, and the route is not duplicated");
{
  check("JobCard.jsx navigates using only job._id in the URL", /navigate\(`\/job\/\$\{job\._id\}`\)/.test(JOB_CARD_SOURCE));
  check("JobCard.jsx's navigate call does not pass a second (state-carrying) argument", !/navigate\(`\/job\/\$\{job\._id\}`,\s*\{/.test(JOB_CARD_SOURCE));
  check("App.jsx registers exactly one route for the Job Detail concept (/job/:id)", (APP_SOURCE.match(/path="\/job\/:id"/g) || []).length === 1);
  check("App.jsx no longer registers the old, broken competing /jobs/:id route", !/path="\/jobs\/:id"/.test(APP_SOURCE));
}

// ---------------------------------------------------------------------------
console.log("\n[17] No Adzuna/RemoteOK API-call patterns were introduced in the new Job Detail files");
{
  const HOSTNAME_PATTERN = /adzuna\.(com|in)|remoteok\.(com|io)|api\.adzuna/i;
  for (const [label, source] of [["JobDetail.jsx", JOB_DETAIL_SOURCE], ["JobDescription.jsx", JOB_DESCRIPTION_SOURCE]]) {
    check(`${label} contains no Adzuna/RemoteOK hostname reference`, !HOSTNAME_PATTERN.test(source));
  }
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
