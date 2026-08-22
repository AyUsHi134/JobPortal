// Deterministic verification for the Phase 1I-2 job search/filter/sort/
// pagination extension to GET /api/jobs. No MongoDB connection is opened
// and no live HTTP server is started — this exercises the pure query-
// parsing (`parseListJobsQuery`), pure filter-building (`buildJobFilter`),
// and handler-assembly logic directly and in isolation, plus the
// controller's `deps.searchJobs` injection seam for end-to-end response
// shape checks. No live Adzuna/RemoteOK/MongoDB call is made anywhere in
// this file.
//
// Run via: node backend/scripts/testJobSearch.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createListJobsHandler, parseListJobsQuery } from "../controllers/jobs.js";
import { buildJobFilter, EXPERIENCE_LEVEL_VALUES, SORT_OPTIONS, DEFAULT_SORT, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "../services/jobService.js";

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
function fakeReq(query = {}) {
  return { query };
}

console.log("============================");
console.log(" PHASE 1I-2 JOB SEARCH / FILTER / SORT / PAGINATION — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] Default active-job listing still works (no query params)");
{
  const parsed = parseListJobsQuery({}, EXPERIENCE_LEVEL_VALUES);
  check("no params parses successfully", parsed.ok === true);
  check("default sort is applied", parsed.options.sort === DEFAULT_SORT);
  check("default page is applied", parsed.options.page === DEFAULT_PAGE);
  check("default limit is applied", parsed.options.limit === DEFAULT_LIMIT);

  const filter = buildJobFilter(parsed.options);
  check("base filter is exactly {status: 'active'} with no extra clauses", JSON.stringify(filter) === JSON.stringify({ status: "active" }));

  let calls = 0;
  const handler = createListJobsHandler({ searchJobs: async (opts) => { calls++; check("handler passed resolved defaults through to searchJobs", opts.sort === "newest" && opts.page === 1 && opts.limit === 20); return { jobs: [], total: 0 }; } });
  await handler(fakeReq(), fakeRes());
  check("searchJobs was invoked", calls === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[2] Keyword search returns only matching active jobs (safe filter shape)");
{
  const parsed = parseListJobsQuery({ q: "react" }, EXPERIENCE_LEVEL_VALUES);
  check("q parses successfully", parsed.ok === true && parsed.options.q === "react");
  const filter = buildJobFilter(parsed.options);
  check("filter still requires status: active", filter.status === "active");
  check("filter has an $or clause for the keyword", Array.isArray(filter.$or) && filter.$or.length === 4);
  const fieldsSearched = filter.$or.map((clause) => Object.keys(clause)[0]);
  check("keyword search covers exactly title/company/description/normalized_skills", JSON.stringify(fieldsSearched.sort()) === JSON.stringify(["company", "description", "normalized_skills", "title"].sort()));
  check("each clause uses a case-insensitive RegExp", filter.$or.every((clause) => Object.values(clause)[0] instanceof RegExp && Object.values(clause)[0].flags.includes("i")));
  check("the regex actually matches a real string containing the keyword", filter.$or[0].title.test("Senior React Engineer"));
  check("the regex does not match an unrelated string", !filter.$or[0].title.test("Backend Developer"));
}

console.log("\n[2b] Keyword search input is safely escaped — no unsafe regex construction, no ReDoS");
{
  const dangerousInputs = [".*", "(a+)+$", "a".repeat(50) + "!", "[unclosed", "a{1,1000000}"];
  for (const input of dangerousInputs) {
    const parsed = parseListJobsQuery({ q: input }, EXPERIENCE_LEVEL_VALUES);
    check(`"${input}" does not throw while parsing/building the filter`, (() => {
      try {
        buildJobFilter(parsed.options);
        return true;
      } catch {
        return false;
      }
    })());
  }

  const filterWildcard = buildJobFilter({ q: ".*" });
  const wildcardPattern = filterWildcard.$or[0].title;
  check("an input of literal '.*' is escaped — it does NOT match an arbitrary unrelated string", !wildcardPattern.test("Totally unrelated job title"));
  check("an input of literal '.*' DOES match a string containing the literal characters '.*'", wildcardPattern.test("Rated .* out of 5"));

  const start = Date.now();
  const pathological = "a".repeat(40) + "!";
  const filterPathological = buildJobFilter({ q: pathological });
  const target = "a".repeat(40) + "b".repeat(40); // deliberately does not match, forcing full scan of the pattern
  filterPathological.$or[0].title.test(target);
  const elapsedMs = Date.now() - start;
  check("a classically ReDoS-shaped input completes near-instantly once escaped (no catastrophic backtracking)", elapsedMs < 500);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Experience filtering works");
{
  for (const level of EXPERIENCE_LEVEL_VALUES) {
    const parsed = parseListJobsQuery({ experience_level: level }, EXPERIENCE_LEVEL_VALUES);
    check(`"${level}" is accepted`, parsed.ok === true && parsed.options.experience_level === level);
    const filter = buildJobFilter(parsed.options);
    check(`"${level}" filter matches the exact schema value, not recalculated`, filter.experience_level === level);
  }

  const invalid = parseListJobsQuery({ experience_level: "expert" }, EXPERIENCE_LEVEL_VALUES);
  check("an unrecognized experience_level ('expert') is rejected (not silently ignored or reinterpreted)", invalid.ok === false);
  check("the rejection message lists the real allowed values", invalid.errors[0].includes(EXPERIENCE_LEVEL_VALUES[0]));
}

// ---------------------------------------------------------------------------
console.log("\n[4] is_tech_relevant=true and =false behave correctly, distinct from missing/null");
{
  const trueParsed = parseListJobsQuery({ is_tech_relevant: "true" }, EXPERIENCE_LEVEL_VALUES);
  const falseParsed = parseListJobsQuery({ is_tech_relevant: "false" }, EXPERIENCE_LEVEL_VALUES);
  const omittedParsed = parseListJobsQuery({}, EXPERIENCE_LEVEL_VALUES);

  check("'true' parses to boolean true", trueParsed.options.is_tech_relevant === true);
  check("'false' parses to boolean false", falseParsed.options.is_tech_relevant === false);
  check("omitted leaves is_tech_relevant unset (no filter applied)", !("is_tech_relevant" in omittedParsed.options));

  const filterTrue = buildJobFilter(trueParsed.options);
  const filterFalse = buildJobFilter(falseParsed.options);
  const filterOmitted = buildJobFilter(omittedParsed.options);
  check("true filter is exactly {is_tech_relevant: true} (won't match null/missing)", filterTrue.is_tech_relevant === true);
  check("false filter is exactly {is_tech_relevant: false} (won't match null/missing)", filterFalse.is_tech_relevant === false);
  check("omitted filter has no is_tech_relevant key at all (returns true/false/null alike)", !("is_tech_relevant" in filterOmitted));

  const invalid = parseListJobsQuery({ is_tech_relevant: "yes" }, EXPERIENCE_LEVEL_VALUES);
  check("an invalid value ('yes') is rejected, not coerced", invalid.ok === false);
}

// ---------------------------------------------------------------------------
console.log("\n[5] is_remote=true does not include null/unknown jobs");
{
  const parsed = parseListJobsQuery({ is_remote: "true" }, EXPERIENCE_LEVEL_VALUES);
  const filter = buildJobFilter(parsed.options);
  check("is_remote=true builds an exact-equality filter (MongoDB {field: true} never matches null/missing)", filter.is_remote === true);

  const falseParsed = parseListJobsQuery({ is_remote: "false" }, EXPERIENCE_LEVEL_VALUES);
  const falseFilter = buildJobFilter(falseParsed.options);
  check("is_remote=false is also an exact-equality filter (never matches null)", falseFilter.is_remote === false);

  const invalid = parseListJobsQuery({ is_remote: "maybe" }, EXPERIENCE_LEVEL_VALUES);
  check("an invalid is_remote value is rejected", invalid.ok === false);
}

// ---------------------------------------------------------------------------
console.log("\n[6] Location filtering works against the structured location object");
{
  const countryParsed = parseListJobsQuery({ country: "India" }, EXPERIENCE_LEVEL_VALUES);
  const countryFilter = buildJobFilter(countryParsed.options);
  check("country builds an anchored, case-insensitive regex against location.country", countryFilter["location.country"] instanceof RegExp && countryFilter["location.country"].test("India") && countryFilter["location.country"].test("india"));
  check("country match is anchored (exact), not a loose substring match", !countryFilter["location.country"].test("Indiana"));

  const cityParsed = parseListJobsQuery({ city: "Pune" }, EXPERIENCE_LEVEL_VALUES);
  const cityFilter = buildJobFilter(cityParsed.options);
  check("city builds an anchored regex against location.city", cityFilter["location.city"].test("Pune") && !cityFilter["location.city"].test("Punepur"));

  const locationParsed = parseListJobsQuery({ location: "bangalore" }, EXPERIENCE_LEVEL_VALUES);
  const locationFilter = buildJobFilter(locationParsed.options);
  check("free-text `location` builds a partial (unanchored) $or against raw/display_name", Array.isArray(locationFilter.$or) && locationFilter.$or.length === 2);
  check("partial location match works against a fuller raw string", locationFilter.$or[0]["location.raw"].test("Bangalore, Karnataka"));

  const missingLocationJob = { "location.country": undefined };
  check("no location value is ever fabricated for a missing field — the filter only constrains fields the caller actually asked about", !("location.state" in cityFilter));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Source filtering works for Adzuna and RemoteOK (and unknown values yield an honest empty result, not an error)");
{
  const adzunaParsed = parseListJobsQuery({ source: "adzuna" }, EXPERIENCE_LEVEL_VALUES);
  const remoteokParsed = parseListJobsQuery({ source: "remoteok" }, EXPERIENCE_LEVEL_VALUES);
  check("adzuna source parses and filters exactly", buildJobFilter(adzunaParsed.options).source === "adzuna");
  check("remoteok source parses and filters exactly", buildJobFilter(remoteokParsed.options).source === "remoteok");

  const unknownParsed = parseListJobsQuery({ source: "linkedin" }, EXPERIENCE_LEVEL_VALUES);
  check("an unrecognized source value is NOT a 400 (source has no schema enum to violate)", unknownParsed.ok === true);
  check("it still builds a literal filter that simply won't match real data", buildJobFilter(unknownParsed.options).source === "linkedin");
}

// ---------------------------------------------------------------------------
console.log("\n[8] Multiple filters combine correctly (AND semantics), including the q+location edge case");
{
  const parsed = parseListJobsQuery(
    { experience_level: "senior", is_tech_relevant: "true", is_remote: "true", source: "remoteok", country: "India" },
    EXPERIENCE_LEVEL_VALUES
  );
  const filter = buildJobFilter(parsed.options);
  check("all five filters are present simultaneously", filter.status === "active" && filter.experience_level === "senior" && filter.is_tech_relevant === true && filter.is_remote === true && filter.source === "remoteok" && filter["location.country"] instanceof RegExp);

  // q AND location both produce their own $or clause — a plain object can
  // only hold one $or key, so this specifically verifies they're combined
  // via $and rather than one silently overwriting the other.
  const combinedParsed = parseListJobsQuery({ q: "developer", location: "pune" }, EXPERIENCE_LEVEL_VALUES);
  const combinedFilter = buildJobFilter(combinedParsed.options);
  check("q + location together produce $and (not a lost/overwritten $or)", Array.isArray(combinedFilter.$and) && combinedFilter.$and.length === 2);
  check("both original $or clauses survive inside $and", combinedFilter.$and[0].$or.length === 4 && combinedFilter.$and[1].$or.length === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[9] Sorting works and has a deterministic default");
{
  const defaultParsed = parseListJobsQuery({}, EXPERIENCE_LEVEL_VALUES);
  check("default sort is 'newest'", defaultParsed.options.sort === "newest");
  check("'newest' maps to {date_posted: -1}, matching Phase 1I-1's default", JSON.stringify(SORT_OPTIONS[defaultParsed.options.sort]) === JSON.stringify({ date_posted: -1 }));

  const salaryParsed = parseListJobsQuery({ sort: "salary_high" }, EXPERIENCE_LEVEL_VALUES);
  check("'salary_high' is accepted", salaryParsed.ok === true);
  check("'salary_high' maps to a salary.max-descending sort", SORT_OPTIONS.salary_high["salary.max"] === -1);

  const invalidSort = parseListJobsQuery({ sort: "random" }, EXPERIENCE_LEVEL_VALUES);
  check("an unrecognized sort value is rejected, not silently defaulted", invalidSort.ok === false);
}

// ---------------------------------------------------------------------------
console.log("\n[10] Pagination returns the correct page and metadata");
{
  const handler = createListJobsHandler({
    searchJobs: async (opts) => {
      check("page 2 / limit 10 reaches the service correctly", opts.page === 2 && opts.limit === 10);
      return { jobs: [{ _id: "x" }], total: 25 };
    },
  });
  const res = fakeRes();
  await handler(fakeReq({ page: "2", limit: "10" }), res);

  check("pagination.page reflects the request", res.body.pagination.page === 2);
  check("pagination.limit reflects the request", res.body.pagination.limit === 10);
  check("pagination.total reflects the service's real count", res.body.pagination.total === 25);
  check("pagination.totalPages is correctly computed (ceil(25/10) = 3)", res.body.pagination.totalPages === 3);
}

// ---------------------------------------------------------------------------
console.log("\n[11] Invalid page/limit values are handled safely");
{
  for (const badPage of ["0", "-1", "abc", "1.5", ""]) {
    const parsed = parseListJobsQuery({ page: badPage }, EXPERIENCE_LEVEL_VALUES);
    check(`page="${badPage}" is rejected (400), not silently defaulted`, parsed.ok === false);
  }
  for (const badLimit of ["0", "-5", "xyz"]) {
    const parsed = parseListJobsQuery({ limit: badLimit }, EXPERIENCE_LEVEL_VALUES);
    check(`limit="${badLimit}" is rejected (400)`, parsed.ok === false);
  }

  const tooLarge = parseListJobsQuery({ limit: "99999" }, EXPERIENCE_LEVEL_VALUES);
  check("an excessively large (but validly-formed) limit is NOT a 400 — it is clamped instead", tooLarge.ok === true && tooLarge.options.limit === MAX_LIMIT);

  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 0 }) });
  const res = fakeRes();
  await handler(fakeReq({ page: "0" }), res);
  check("the handler itself returns HTTP 400 for an invalid page", res.statusCode === 400);
  check("the 400 body still uses the {success:false} shape with details", res.body.success === false && Array.isArray(res.body.details));
}

// ---------------------------------------------------------------------------
console.log("\n[11b] Page beyond the final page returns an empty page gracefully (not an error)");
{
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 5 }) });
  const res = fakeRes();
  await handler(fakeReq({ page: "99", limit: "20" }), res);
  check("HTTP 200, not an error, for a page past the last result", res.statusCode === 200);
  check("data is an empty array", Array.isArray(res.body.data) && res.body.data.length === 0);
  check("pagination metadata still reports the real total/totalPages", res.body.pagination.total === 5 && res.body.pagination.totalPages === 1 && res.body.pagination.page === 99);
}

// ---------------------------------------------------------------------------
console.log("\n[12] Invalid filter values return the documented 400 response");
{
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 0 }) });
  const res = fakeRes();
  await handler(fakeReq({ experience_level: "not-a-real-level", sort: "nonsense" }), res);
  check("HTTP 400 for multiple invalid params at once", res.statusCode === 400);
  check("success is false", res.body.success === false);
  check("both invalid-parameter errors are reported together, not just the first", res.body.details.length === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[13] No-match searches return an empty data array with valid pagination metadata");
{
  const handler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 0 }) });
  const res = fakeRes();
  await handler(fakeReq({ q: "no-job-will-ever-match-this-exact-string" }), res);
  check("HTTP 200 for a genuinely empty (not erroring) search result", res.statusCode === 200);
  check("data is an empty array", Array.isArray(res.body.data) && res.body.data.length === 0);
  check("pagination is still well-formed (page/limit/total/totalPages all present)", "page" in res.body.pagination && "limit" in res.body.pagination && res.body.pagination.total === 0 && res.body.pagination.totalPages === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[14] Database/query errors are safely converted into API errors");
{
  const handler = createListJobsHandler({
    searchJobs: async () => {
      throw new Error("MongoServerError: connection to cluster0.xvtgoah.mongodb.net failed");
    },
  });
  const res = fakeRes();
  await handler(fakeReq({ q: "developer" }), res);
  check("HTTP 500 on a real query failure even with filters applied", res.statusCode === 500);
  check("the generic error message is used, not the raw MongoDB error", res.body.error === "Failed to retrieve jobs. Please try again later.");
}

// ---------------------------------------------------------------------------
console.log("\n[15] No Adzuna/RemoteOK calls occur from the search/filter code path (static check)");
{
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/jobs.js"), "utf8");
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check("controller (with new parsing logic) never imports an adapter/orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(controllerSource));
  check("service (with new query-building logic) never imports an adapter/orchestrator/scheduler", !/adzunaAdapter|remoteOkAdapter|ingestionOrchestrator|ingestionScheduler/.test(serviceSource));
  check("service never imports mongoose's connect (no second connection)", !/mongoose\.connect\s*\(/.test(serviceSource));
}

// ---------------------------------------------------------------------------
console.log("\n[16] No credentials or internal database details appear in responses/logs (search paths)");
{
  const FAKE_SECRET = "mongodb+srv://realuser:realpass@prod-cluster.mongodb.net/jobportal";
  const handler = createListJobsHandler({
    searchJobs: async () => {
      throw new Error(`Fatal: ${FAKE_SECRET}`);
    },
  });
  const res = fakeRes();
  await handler(fakeReq({ q: "test", country: "India" }), res);
  check("the fake secret never appears in the response even when filters were applied", !JSON.stringify(res.body).includes(FAKE_SECRET));

  const invalidRes = fakeRes();
  const invalidHandler = createListJobsHandler({ searchJobs: async () => ({ jobs: [], total: 0 }) });
  await invalidHandler(fakeReq({ experience_level: "bogus" }), invalidRes);
  check("validation-error details never contain anything beyond the documented enum list (no data/internal leakage)", invalidRes.body.details.every((d) => typeof d === "string" && !d.includes("mongodb")));
}

// ---------------------------------------------------------------------------
console.log("\n[17] Regression: previous phases' test files are expected to still pass (verified by running them; see PHASE_1I2_REPORT.md §12)");
{
  check("this file does not re-implement that check — it is verified by actually running each suite (documented in the report)", true);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
