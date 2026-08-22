// Deterministic verification for frontend/src/services/jobsApi.js
// (Phase 2B): listJobs/getJobById correctly parse the finalized backend
// envelopes, buildJobQueryParams serializes/allowlists filter params
// correctly, and createJob/updateJob/deleteJob use the correct
// endpoints. Compared directly against BACKEND_API_CONTRACT.md §2-§5.
// No real network call is made (mocked axios adapter). Run via
// `node src/tests/testJobsApi.js`.

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const { apiClient } = await import("../services/api.js");
const { listJobs, getJobById, createJob, updateJob, deleteJob, buildJobQueryParams } = await import("../services/jobsApi.js");

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

const SAMPLE_JOB = {
  _id: "60f7c2b5c1234567890000aa",
  title: "Backend Developer",
  company: "Acme",
  description: "desc",
  apply_link: "https://example.com",
  location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
  salary: { min: null, max: null, currency: null, is_estimated: null },
  job_type: "full_time",
  is_remote: null,
  experience_level: "unknown",
  is_tech_relevant: true,
  tech_relevance_source: "source_category",
  source_category: "IT Jobs",
  tags: [],
  normalized_skills: [],
  logo: "",
  date_posted: "2026-08-10T09:15:00.000Z",
  status: "active",
  source: "adzuna",
  source_id: "5900001234",
};

console.log("============================");
console.log(" JOBS API — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] buildJobQueryParams keeps only recognized backend parameters");
{
  const params = buildJobQueryParams({
    q: "react",
    experience_level: "fresher",
    is_tech_relevant: true,
    is_remote: false,
    country: "India",
    state: "Maharashtra",
    city: "Pune",
    location: "bangalore",
    source: "adzuna",
    sort: "newest",
    page: 2,
    limit: 10,
    // Not a recognized backend parameter — must be dropped:
    notAThing: "should never be sent",
  });

  check("all 12 recognized parameters survive", Object.keys(params).length === 12);
  check("q survives", params.q === "react");
  check("experience_level survives", params.experience_level === "fresher");
  check("is_tech_relevant survives", params.is_tech_relevant === true);
  check("is_remote survives (including a literal `false`, not treated as an empty/falsy omission)", params.is_remote === false);
  check("page/limit survive as numbers", params.page === 2 && params.limit === 10);
  check("an unrecognized key is silently dropped, never forwarded", !("notAThing" in params));
}

// ---------------------------------------------------------------------------
console.log("\n[2] buildJobQueryParams omits undefined/null/empty-string values (not literal 'undefined' in the query string)");
{
  const params = buildJobQueryParams({ q: "", location: undefined, source: null, page: 1 });
  check("empty string q is omitted", !("q" in params));
  check("undefined location is omitted", !("location" in params));
  check("null source is omitted", !("source" in params));
  check("a real value (page) still survives alongside the omitted ones", params.page === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[3] buildJobQueryParams with no filters at all produces an empty params object (today's call-site behavior)");
{
  const params = buildJobQueryParams();
  check("no params are sent when called with nothing — reproduces the current 'just get jobs' call sites exactly", Object.keys(params).length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[4] listJobs() calls GET /api/jobs and correctly unwraps {success, data, pagination}");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    {
      status: 200,
      data: { success: true, data: [SAMPLE_JOB], pagination: { page: 1, limit: 20, total: 113, totalPages: 6 } },
    },
    (config) => { captured = config; }
  );

  const result = await listJobs({ is_tech_relevant: true, sort: "newest" });

  check("GET method used", captured.method === "get");
  check("the correct path", captured.url === "/api/jobs");
  check("the filter params were serialized into the request", captured.params.is_tech_relevant === true && captured.params.sort === "newest");
  check("jobs is the real array (not the whole envelope)", Array.isArray(result.jobs) && result.jobs.length === 1 && result.jobs[0]._id === SAMPLE_JOB._id);
  check("pagination metadata is passed through", result.pagination.total === 113 && result.pagination.totalPages === 6);
  check("the caller never has to know about the {success,...} wrapper — `success` isn't part of the returned shape", !("success" in result));
}

// ---------------------------------------------------------------------------
console.log("\n[5] listJobs() called with no arguments sends no query params (today's Home.jsx/FindJob.jsx behavior)");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } },
    (config) => { captured = config; }
  );

  await listJobs();

  check("no query parameters were sent", Object.keys(captured.params).length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[6] getJobById() calls GET /api/jobs/:id and correctly unwraps {success, data}");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, data: SAMPLE_JOB } }, (config) => {
    captured = config;
  });

  const job = await getJobById("60f7c2b5c1234567890000aa");

  check("GET method used", captured.method === "get");
  check("the correct path with the id interpolated", captured.url === "/api/jobs/60f7c2b5c1234567890000aa");
  check("the job object is unwrapped from the envelope", job._id === SAMPLE_JOB._id && job.title === SAMPLE_JOB.title);
  check("the returned job's location is still the real structured object (untouched by this layer)", typeof job.location === "object" && job.location.city === "Pune");
}

// ---------------------------------------------------------------------------
console.log("\n[7] createJob() posts to /api/jobs and unwraps the created job");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 201, data: { success: true, data: SAMPLE_JOB } }, (config) => {
    captured = config;
  });

  const job = await createJob({ title: "New Job", company: "Acme", description: "d" });

  check("POST method used", captured.method === "post");
  check("the correct path", captured.url === "/api/jobs");
  check("the created job is unwrapped from the envelope", job._id === SAMPLE_JOB._id);
}

// ---------------------------------------------------------------------------
console.log("\n[8] updateJob() puts to /api/jobs/:id and unwraps the updated job");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, data: { ...SAMPLE_JOB, title: "Updated" } } }, (config) => {
    captured = config;
  });

  const job = await updateJob("60f7c2b5c1234567890000aa", { title: "Updated" });

  check("PUT method used", captured.method === "put");
  check("the correct path with the id interpolated", captured.url === "/api/jobs/60f7c2b5c1234567890000aa");
  check("the updated job is unwrapped", job.title === "Updated");
}

// ---------------------------------------------------------------------------
console.log("\n[9] deleteJob() deletes /api/jobs/:id and resolves with no value (matching the backend's 204)");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 204, data: "" }, (config) => {
    captured = config;
  });

  const result = await deleteJob("60f7c2b5c1234567890000aa");

  check("DELETE method used", captured.method === "delete");
  check("the correct path with the id interpolated", captured.url === "/api/jobs/60f7c2b5c1234567890000aa");
  check("resolves with undefined (no body to unwrap)", result === undefined);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
