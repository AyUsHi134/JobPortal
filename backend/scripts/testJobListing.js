// Deterministic verification for the core `GET /api/jobs` listing
// contract (originally Phase 1I-1; updated in Phase 1I-2 to match the
// `searchJobs`-based handler that replaced the old `listActiveJobs`
// call, since that phase intentionally extended the response with
// pagination metadata — see PHASE_1I2_REPORT.md §9/§11 for exactly what
// changed here and why). This file focuses on the general
// listing/response contract (success shape, error safety, no external
// calls, field structure, existing-CRUD-preserved); search/filter/sort/
// pagination-specific behavior has its own dedicated coverage in
// backend/scripts/testJobSearch.js.
//
// No MongoDB connection is opened and no live HTTP server is started —
// the controller's `deps.searchJobs` injection seam (the same
// established pattern used by the ingestion orchestrator/scheduler in
// Phase 1H) supplies fixture data or simulated failures, and a minimal
// fake Express `res` object records what the handler sends.
//
// Run via: node backend/scripts/testJobListing.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createListJobsHandler } from "../controllers/jobs.js";

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

// Minimal fake Express response object — just enough to observe what a
// controller sent, with no framework/dependency involved.
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

function fakeReq(query = {}) {
  return { query };
}

function activeJobFixture(overrides = {}) {
  return {
    _id: "6a0000000000000000000001",
    title: "Backend Developer (Node.js)",
    company: "Brightline Systems Pvt Ltd",
    description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
    apply_link: "https://www.adzuna.in/land/ad/5900001234",
    location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
    salary: { min: 800000, max: 1200000, currency: null, is_estimated: false },
    job_type: "full_time",
    is_remote: null,
    experience_level: "unknown",
    is_tech_relevant: true,
    tech_relevance_source: "source_category",
    source_category: "IT Jobs",
    tags: [],
    normalized_skills: [],
    logo: "",
    date_posted: new Date("2026-08-10T09:15:00Z"),
    status: "active",
    source: "adzuna",
    source_id: "5900001234",
    ...overrides,
  };
}

console.log("============================");
console.log(" JOB LISTING API — DETERMINISTIC TESTS (general contract)");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[L1] Active jobs are returned successfully");
{
  const fixtureJobs = [activeJobFixture(), activeJobFixture({ _id: "6a0000000000000000000002", source: "remoteok", source_id: "1140002" })];
  let calls = 0;
  const handler = createListJobsHandler({
    searchJobs: async () => {
      calls++;
      return { jobs: fixtureJobs, total: fixtureJobs.length };
    },
  });
  const res = fakeRes();
  await handler(fakeReq(), res);

  check("searchJobs was called exactly once", calls === 1);
  check("HTTP 200 (default) status used for success", res.statusCode === 200);
  check("response body contains both fixture jobs", Array.isArray(res.body.data) && res.body.data.length === 2);
  check("returned jobs are exactly what the service provided (no mutation)", res.body.data[0] === fixtureJobs[0] && res.body.data[1] === fixtureJobs[1]);
}

// ---------------------------------------------------------------------------
console.log("\n[L2] Response structure is consistent (success + data + pagination)");
{
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [activeJobFixture()], total: 1 }) });
  const res = fakeRes();
  await handler(fakeReq(), res);

  check("body has a boolean `success` field", typeof res.body.success === "boolean");
  check("`success` is true on a successful call", res.body.success === true);
  check("body has a `data` array field", Array.isArray(res.body.data));
  check("body has a `pagination` object field (Phase 1I-2 extension)", typeof res.body.pagination === "object" && res.body.pagination !== null);
  check("body has no unexpected extra top-level keys", Object.keys(res.body).sort().join(",") === "data,pagination,success");
}

// ---------------------------------------------------------------------------
console.log("\n[L3] An empty result is handled correctly (not an error)");
{
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 0 }) });
  const res = fakeRes();
  await handler(fakeReq(), res);

  check("HTTP 200 status on an empty result (not treated as an error)", res.statusCode === 200);
  check("`success` is still true", res.body.success === true);
  check("`data` is a valid empty array, not null/undefined", Array.isArray(res.body.data) && res.body.data.length === 0);
  check("pagination.total is 0", res.body.pagination.total === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[L4] Database/query errors are converted into safe API errors");
{
  const originalError = console.error;
  const loggedMessages = [];
  console.error = (...args) => loggedMessages.push(args.join(" "));

  const SENSITIVE_MESSAGE = "MongoServerError: bad auth for user jobportaluser:S3cr3tP@ssw0rd@cluster0.xvtgoah.mongodb.net";
  const handler = createListJobsHandler({
    searchJobs: async () => {
      throw new Error(SENSITIVE_MESSAGE);
    },
  });
  const res = fakeRes();
  await handler(fakeReq(), res);

  console.error = originalError;

  check("HTTP 500 status on a query failure", res.statusCode === 500);
  check("`success` is false", res.body.success === false);
  check("response has a generic, non-empty error message", typeof res.body.error === "string" && res.body.error.length > 0);
  check("the raw underlying error message is NEVER echoed to the client", !JSON.stringify(res.body).includes(SENSITIVE_MESSAGE));
  check("the real error was still logged server-side (not silently swallowed)", loggedMessages.some((m) => m.includes(SENSITIVE_MESSAGE)));
}

// ---------------------------------------------------------------------------
console.log("\n[L5] The endpoint never calls Adzuna or RemoteOK (static check)");
{
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check("controller never imports an adapter or the orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(controllerSource));
  check("service never imports an adapter or the orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(serviceSource));
  check("controller never imports axios (no outbound HTTP capability)", !/from\s+["']axios["']/.test(controllerSource));
  check("service never imports axios (no outbound HTTP capability)", !/from\s+["']axios["']/.test(serviceSource));
}

// ---------------------------------------------------------------------------
console.log("\n[L6] Structured `location` and `salary` fields are returned correctly, unmodified");
{
  const job = activeJobFixture({
    location: { raw: "Berlin, Germany", display_name: "Berlin, Germany", city: null, state: null, country: null },
    salary: { min: 90000, max: 130000, currency: null, is_estimated: null },
  });
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [job], total: 1 }) });
  const res = fakeRes();
  await handler(fakeReq(), res);

  const returned = res.body.data[0];
  check("location is returned as a structured object with raw/city/state/country", returned.location && returned.location.raw === "Berlin, Germany" && returned.location.city === null);
  check("salary is returned as a structured object with min/max/currency/is_estimated", returned.salary && returned.salary.min === 90000 && returned.salary.max === 130000 && "is_estimated" in returned.salary);
  check("location/salary are not flattened, stringified, or renamed", typeof returned.location === "object" && typeof returned.salary === "object");
}

// ---------------------------------------------------------------------------
console.log("\n[L7] Existing job route behavior outside this phase's scope is unchanged");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/job.js"), "utf8");
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");

  // routes/job.js's write routes (POST/PUT/DELETE) were INTENTIONALLY
  // changed by Phase 1I-4 to require authMiddleware (see
  // PHASE_1I4_REPORT.md — these were previously fully unauthenticated).
  // GET routes remain public/untouched; the write routes still resolve
  // to the same controllers, just gated by auth first now. Dedicated
  // coverage of the auth requirement itself lives in testAuthorization.js.
  check("routes/job.js still imports the same 5 handlers plus authMiddleware", /listJobs,\s*getJob,\s*createJob,\s*updateJob,\s*removeJob/.test(routeSource) && /import authMiddleware from ["']\.\.\/middleware\/auth\.js["']/.test(routeSource));
  check("GET /:id still wired to getJob (public, unchanged)", /router\.get\(\s*["']\/:id["']\s*,\s*getJob\s*\)/.test(routeSource));
  check("POST / still resolves to createJob (now behind authMiddleware)", /router\.post\(\s*["']\/["']\s*,\s*authMiddleware\s*,\s*createJob\s*\)/.test(routeSource));
  check("PUT /:id still resolves to updateJob (now behind authMiddleware)", /router\.put\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*updateJob\s*\)/.test(routeSource));
  check("DELETE /:id still resolves to removeJob (now behind authMiddleware)", /router\.delete\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*removeJob\s*\)/.test(routeSource));

  // getJob's response shape was INTENTIONALLY changed by Phase 1I-3 (see
  // PHASE_1I3_REPORT.md) — from a bare `{error}`/raw-document shape to
  // the same `{success, data}` / `{success, error}` convention already
  // established by the listing endpoint, plus id-format validation and
  // an active-only/public-field-whitelisted lookup. That change has its
  // own dedicated deterministic coverage in testJobDetails.js; this file
  // only re-confirms the route wiring itself (still `GET /:id` → `getJob`,
  // checked above) was not disturbed.
  // routes/job.js's POST/PUT/DELETE wiring was INTENTIONALLY changed by
  // Phase 1I-4 (see PHASE_1I4_REPORT.md) to require authMiddleware —
  // these routes were previously fully unauthenticated. That change has
  // its own dedicated coverage in testAuthorization.js [P9]; this file's
  // controller-body checks below (unaffected by the route-wiring change)
  // still hold.
  // createJob/updateJob's response shape and error handling were
  // INTENTIONALLY changed by Phase 1I-5 (see PHASE_1I5_REPORT.md) — from
  // an unguarded raw-document response to the same {success, data}
  // convention and public field whitelist listJobs/getJob already use,
  // plus id validation, try/catch, and MongoDB-update-operator-injection
  // prevention (req.body was previously usable to smuggle raw Mongo
  // update operators into PUT /api/jobs/:id). That change has its own
  // dedicated deterministic coverage in testJobMutationSecurity.js.
  check("removeJob's 204 behavior is unchanged", /removeJob[\s\S]*?res\.status\(204\)\.send\(\)/.test(controllerSource));

  check("jobService.listJobs(filter) generic function is still present and untouched", /export async function listJobs\(filter = \{\}\) \{\s*return Job\.find\(filter\);\s*\}/.test(fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8")));
}

// ---------------------------------------------------------------------------
console.log("\n[L8] No credentials or internal database details appear in responses/logs");
{
  const FAKE_SECRET = "mongodb+srv://faketestuser:faketestpass@cluster0.example.mongodb.net/jobportal";
  const originalError = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args.join(" "));

  const handler = createListJobsHandler({
    searchJobs: async () => {
      throw new Error(`Connection failed: ${FAKE_SECRET}`);
    },
  });
  const res = fakeRes();
  await handler(fakeReq(), res);
  console.error = originalError;

  check("the fake connection string never appears in the HTTP response", !JSON.stringify(res.body).includes(FAKE_SECRET));
  check("the response error message is the fixed generic string, not derived from the real error", res.body.error === "Failed to retrieve jobs. Please try again later.");
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
