// Deterministic verification for the Phase 1I-3 Job Detail endpoint,
// `GET /api/jobs/:id`. No MongoDB connection is opened and no live HTTP
// server is started — the controller's `deps.getActiveJobById` injection
// seam (the same established pattern used by `createListJobsHandler` in
// Phase 1I-1/1I-2) supplies fixture data or simulated failures, and a
// minimal fake Express `res` object records what the handler sends.
//
// Run via: node backend/scripts/testJobDetails.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { createGetJobHandler } from "../controllers/jobs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function fakeReq(id) {
  return { params: { id } };
}

const VALID_ID = "60f7c2b5c1234567890000aa"; // well-formed 24-char hex ObjectId string

// The exact public shape jobService.getActiveJobById is expected to
// return (already field-whitelisted + status-filtered by the service —
// this fixture represents that post-query, post-.select() result, not a
// raw Mongo document).
function activeJobDetailFixture(overrides = {}) {
  return {
    _id: VALID_ID,
    title: "Backend Developer (Node.js)",
    company: "Brightline Systems Pvt Ltd",
    description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
    apply_link: "https://www.adzuna.in/land/ad/5900001234",
    location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
    salary: { min: 800000, max: 1200000, currency: null, is_estimated: false },
    job_type: "full_time",
    is_remote: null,
    experience_level: "mid",
    is_tech_relevant: true,
    tech_relevance_source: "source_category",
    source_category: "IT Jobs",
    tags: ["nodejs"],
    normalized_skills: ["node.js", "javascript"],
    logo: "",
    date_posted: new Date("2026-08-10T09:15:00Z"),
    status: "active",
    source: "adzuna",
    source_id: "5900001234",
    ...overrides,
  };
}

const EXPECTED_PUBLIC_KEYS = [
  "_id",
  "title",
  "company",
  "description",
  "apply_link",
  "location",
  "salary",
  "job_type",
  "is_remote",
  "experience_level",
  "is_tech_relevant",
  "tech_relevance_source",
  "source_category",
  "tags",
  "normalized_skills",
  "logo",
  "date_posted",
  "status",
  "source",
  "source_id",
].sort();

const FORBIDDEN_INTERNAL_FIELDS = ["dedup_fingerprint", "hiring_stage", "last_seen_at", "expires_at", "createdAt", "updatedAt", "__v"];

console.log("============================");
console.log(" JOB DETAIL API — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[D1] Existing active job is returned successfully");
{
  const fixture = activeJobDetailFixture();
  let calls = 0;
  let receivedId;
  const handler = createGetJobHandler({
    getActiveJobById: async (id) => {
      calls++;
      receivedId = id;
      return fixture;
    },
  });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  check("getActiveJobById was called exactly once", calls === 1);
  check("the requested id was passed through unmodified", receivedId === VALID_ID);
  check("HTTP 200 (default) status used for success", res.statusCode === 200);
  check("response body has success: true", res.body.success === true);
  check("response body has a data object (not an array, not null)", typeof res.body.data === "object" && res.body.data !== null && !Array.isArray(res.body.data));
  check("returned job is exactly what the service provided (no mutation)", res.body.data === fixture);
  check("response has no unexpected extra top-level keys", Object.keys(res.body).sort().join(",") === "data,success");
}

// ---------------------------------------------------------------------------
console.log("\n[D2] Returned object contains the expected normalized structured fields");
{
  const fixture = activeJobDetailFixture();
  const handler = createGetJobHandler({ getActiveJobById: async () => fixture });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  const job = res.body.data;
  check("location is a structured object with raw/display_name/city/state/country", job.location && job.location.raw === "Pune, Maharashtra" && job.location.city === "Pune" && job.location.state === "Maharashtra" && job.location.country === "India");
  check("salary is a structured object with min/max/currency/is_estimated", job.salary && job.salary.min === 800000 && job.salary.max === 1200000 && "currency" in job.salary && "is_estimated" in job.salary);
  check("is_remote (tri-state) is present", "is_remote" in job);
  check("experience_level is present", job.experience_level === "mid");
  check("is_tech_relevant + tech_relevance_source (tech relevance) are present", job.is_tech_relevant === true && job.tech_relevance_source === "source_category");
  check("normalized_skills is a real array", Array.isArray(job.normalized_skills) && job.normalized_skills.length === 2);
  check("source and source_id are present", job.source === "adzuna" && job.source_id === "5900001234");
  check("apply_link is present", job.apply_link === "https://www.adzuna.in/land/ad/5900001234");
  check("date_posted (posting date) is present", job.date_posted instanceof Date);
  check("status (lifecycle information) is present and active", job.status === "active");
}

// ---------------------------------------------------------------------------
console.log("\n[D3] Public-field whitelist prevents internal fields from leaking");
{
  // (a) Behavioral: the controller passes the service's result straight
  // through with no additions — if the service (which does the actual
  // field selection) returns only whitelisted keys, so does the response.
  const fixture = activeJobDetailFixture();
  const handler = createGetJobHandler({ getActiveJobById: async () => fixture });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  const returnedKeys = Object.keys(res.body.data).sort();
  check("returned job object has exactly the expected public key set, nothing more/less", returnedKeys.join(",") === EXPECTED_PUBLIC_KEYS.join(","));
  for (const field of FORBIDDEN_INTERNAL_FIELDS) {
    check(`internal field "${field}" is not present on the returned job`, !(field in res.body.data));
  }

  // (b) Static: the service itself only ever selects the same whitelist
  // the listing endpoint uses (PUBLIC_LISTING_FIELDS) — proving the
  // whitelist is enforced at the query layer, not just accidentally
  // absent from this test's fixture.
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check(
    "jobService.getActiveJobById selects PUBLIC_LISTING_FIELDS (the same whitelist the listing endpoint uses)",
    /export async function getActiveJobById\(id\) \{\s*return Job\.findOne\(\{ _id: id, status: "active" \}\)\.select\(PUBLIC_LISTING_FIELDS\)\.lean\(\);\s*\}/.test(serviceSource)
  );
  const fieldListSlice = serviceSource.slice(serviceSource.indexOf("PUBLIC_LISTING_FIELDS = ["), serviceSource.indexOf("].join"));
  for (const field of FORBIDDEN_INTERNAL_FIELDS.filter((f) => f !== "createdAt" && f !== "updatedAt" && f !== "__v")) {
    check(`PUBLIC_LISTING_FIELDS itself never lists "${field}"`, !new RegExp(`"${field}"`).test(fieldListSlice));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[D4] A nonexistent job id returns 404");
{
  let calls = 0;
  const handler = createGetJobHandler({
    getActiveJobById: async () => {
      calls++;
      return null;
    },
  });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  check("getActiveJobById was still called (id was valid, just no match)", calls === 1);
  check("HTTP 404 status", res.statusCode === 404);
  check("success is false", res.body.success === false);
  check("a non-empty error message is present", typeof res.body.error === "string" && res.body.error.length > 0);
  check("no data field is present on a 404", !("data" in res.body));
}

// ---------------------------------------------------------------------------
console.log("\n[D5] A malformed/invalid MongoDB id returns 400 without ever querying the database");
{
  const malformedIds = ["abc", "12345", "", "not-a-valid-id!!", "60f7c2b5c1234567890000zz", "../../etc/passwd", "  "];
  for (const badId of malformedIds) {
    let calls = 0;
    const handler = createGetJobHandler({
      getActiveJobById: async () => {
        calls++;
        return activeJobDetailFixture();
      },
    });
    const res = fakeRes();
    await handler(fakeReq(badId), res);

    check(`"${badId}" → HTTP 400`, res.statusCode === 400);
    check(`"${badId}" → success: false`, res.body.success === false);
    check(`"${badId}" → the service is never called (rejected before any DB lookup)`, calls === 0);
  }

  // Control case: a well-formed id must NOT be rejected by the same check.
  check("a well-formed 24-char hex id is considered valid by mongoose.Types.ObjectId.isValid", mongoose.Types.ObjectId.isValid(VALID_ID));
}

// ---------------------------------------------------------------------------
console.log("\n[D6] An inactive (or legacy status-less) job is never exposed through this endpoint");
{
  // jobService.getActiveJobById's own Mongo query restricts to
  // status:"active" (verified statically below) — so from the
  // controller's perspective, a real-but-inactive job and a genuinely
  // nonexistent job are indistinguishable (both resolve to `null`), and
  // both correctly produce a 404 rather than ever exposing the job or
  // revealing that an inactive job exists at that id.
  const handler = createGetJobHandler({ getActiveJobById: async () => null });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  check("an inactive job's id resolves to HTTP 404, exactly like a nonexistent id", res.statusCode === 404);
  check("the 404 response never distinguishes 'inactive' from 'nonexistent'", res.body.error === "Job not found.");

  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check(
    "the underlying query is statically restricted to status: \"active\" (never expired/filled/removed/status-less)",
    /Job\.findOne\(\{ _id: id, status: "active" \}\)/.test(serviceSource)
  );
}

// ---------------------------------------------------------------------------
console.log("\n[D7] Database/query failures are converted into a safe, generic 500");
{
  const originalError = console.error;
  const loggedMessages = [];
  console.error = (...args) => loggedMessages.push(args.join(" "));

  const SENSITIVE_MESSAGE = "MongoServerError: bad auth for user jobportaluser:S3cr3tP@ssw0rd@cluster0.xvtgoah.mongodb.net";
  const handler = createGetJobHandler({
    getActiveJobById: async () => {
      throw new Error(SENSITIVE_MESSAGE);
    },
  });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);

  console.error = originalError;

  check("HTTP 500 status on a query failure", res.statusCode === 500);
  check("success is false", res.body.success === false);
  check("response has a generic, non-empty error message", typeof res.body.error === "string" && res.body.error.length > 0);
  check("the raw underlying error message is NEVER echoed to the client", !JSON.stringify(res.body).includes(SENSITIVE_MESSAGE));
  check("the real error was still logged server-side (not silently swallowed)", loggedMessages.some((m) => m.includes(SENSITIVE_MESSAGE)));
}

// ---------------------------------------------------------------------------
console.log("\n[D8] No Adzuna/RemoteOK calls occur during job-detail lookup (static check)");
{
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check("controller never imports an adapter or the orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(controllerSource));
  check("service never imports an adapter or the orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(serviceSource));
  check("controller never imports axios (no outbound HTTP capability)", !/from\s+["']axios["']/.test(controllerSource));
  check("service never imports axios (no outbound HTTP capability)", !/from\s+["']axios["']/.test(serviceSource));
  check("getActiveJobById performs a single findOne — not a fan-out to any external source", /Job\.findOne\(\{ _id: id, status: "active" \}\)\.select\(PUBLIC_LISTING_FIELDS\)\.lean\(\)/.test(serviceSource));
}

// ---------------------------------------------------------------------------
console.log("\n[D9] No MongoDB credentials or internal database details appear in the response");
{
  const FAKE_SECRET = "mongodb+srv://faketestuser:faketestpass@cluster0.example.mongodb.net/jobportal";
  const originalError = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args.join(" "));

  const handler = createGetJobHandler({
    getActiveJobById: async () => {
      throw new Error(`Connection failed: ${FAKE_SECRET}`);
    },
  });
  const res = fakeRes();
  await handler(fakeReq(VALID_ID), res);
  console.error = originalError;

  check("the fake connection string never appears in the HTTP response", !JSON.stringify(res.body).includes(FAKE_SECRET));
  check("the response error message is the fixed generic string, not derived from the real error", res.body.error === "Failed to retrieve job. Please try again later.");
}

// ---------------------------------------------------------------------------
console.log("\n[D10] Existing GET /api/jobs listing/search/filter/pagination behavior is unchanged");
{
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");

  check("createListJobsHandler is still exported and untouched", /export function createListJobsHandler\(deps = \{\}\) \{/.test(controllerSource));
  check("parseListJobsQuery is still exported and untouched", /export function parseListJobsQuery\(query, experienceLevelEnumValues\) \{/.test(controllerSource));
  check("the default listJobs export still uses createListJobsHandler()", /export const listJobs = createListJobsHandler\(\);/.test(controllerSource));
  check("jobService.searchJobs is still exported and untouched", /export async function searchJobs\(options = \{\}\) \{/.test(serviceSource));
  check("jobService.buildJobFilter is still exported and untouched", /export function buildJobFilter\(options = \{\}\) \{/.test(serviceSource));
  console.log("  (Full behavioral regression for this endpoint is re-verified by re-running testJobListing.js and testJobSearch.js — see PHASE_1I3_REPORT.md §10.)");
}

// ---------------------------------------------------------------------------
console.log("\n[D11] Existing job CRUD behavior outside this phase's scope is unchanged");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/job.js"), "utf8");
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");

  // routes/job.js's write routes (POST/PUT/DELETE) were INTENTIONALLY
  // changed by Phase 1I-4 to require authMiddleware — previously fully
  // unauthenticated. See PHASE_1I4_REPORT.md and testAuthorization.js.
  check("routes/job.js still imports the same 5 handlers plus authMiddleware", /listJobs,\s*getJob,\s*createJob,\s*updateJob,\s*removeJob/.test(routeSource) && /import authMiddleware from ["']\.\.\/middleware\/auth\.js["']/.test(routeSource));
  check("GET /:id still wired to getJob (public, unchanged)", /router\.get\(\s*["']\/:id["']\s*,\s*getJob\s*\)/.test(routeSource));
  check("POST / still resolves to createJob (now behind authMiddleware)", /router\.post\(\s*["']\/["']\s*,\s*authMiddleware\s*,\s*createJob\s*\)/.test(routeSource));
  check("PUT /:id still resolves to updateJob (now behind authMiddleware)", /router\.put\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*updateJob\s*\)/.test(routeSource));
  check("DELETE /:id still resolves to removeJob (now behind authMiddleware)", /router\.delete\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*removeJob\s*\)/.test(routeSource));

  // createJob/updateJob's response shape and error handling were
  // INTENTIONALLY changed by Phase 1I-5 — see testJobListing.js's [L7]
  // block and PHASE_1I5_REPORT.md for the full reasoning; dedicated
  // coverage lives in testJobMutationSecurity.js.
  check("removeJob's 204 behavior is unchanged", /removeJob[\s\S]*?res\.status\(204\)\.send\(\)/.test(controllerSource));
  check("jobService.getJobById(id) (raw fetch, used by ingestion tests) is still present and untouched", /export async function getJobById\(id\) \{\s*return Job\.findById\(id\);\s*\}/.test(fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8")));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
