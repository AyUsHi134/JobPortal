// Deterministic verification for the Phase 2C filter/search state logic
// (frontend/src/utils/jobDiscoveryState.js) plus its integration with
// Phase 2B's jobsApi/buildJobQueryParams — proving each individual
// filter and combinations of filters produce the correct GET /api/jobs
// request. No real network call is made (the same mocked-adapter
// technique Phase 2B's testJobsApi.js established). Run via
// `node src/tests/testJobFilters.js`.

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const { apiClient } = await import("../services/api.js");
const { listJobs } = await import("../services/jobsApi.js");
const {
  DEFAULT_DISCOVERY_FILTERS,
  applyFilterChange,
  resetFilters,
  searchParamsToFilters,
  filtersToSearchParams,
} = await import("../utils/jobDiscoveryState.js");

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

const EMPTY_LISTING_RESPONSE = { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

console.log("============================");
console.log(" JOB SEARCH/FILTER STATE — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] Changing any filter/search/sort field resets page to 1");
{
  const onPage3 = { ...DEFAULT_DISCOVERY_FILTERS, page: 3, q: "old search" };
  check("changing q resets page", applyFilterChange(onPage3, { q: "react" }).page === 1);
  check("changing experience_level resets page", applyFilterChange(onPage3, { experience_level: "fresher" }).page === 1);
  check("changing is_tech_relevant resets page", applyFilterChange(onPage3, { is_tech_relevant: "true" }).page === 1);
  check("changing is_remote resets page", applyFilterChange(onPage3, { is_remote: "true" }).page === 1);
  check("changing location resets page", applyFilterChange(onPage3, { location: "Pune" }).page === 1);
  check("changing source resets page", applyFilterChange(onPage3, { source: "adzuna" }).page === 1);
  check("changing sort resets page", applyFilterChange(onPage3, { sort: "oldest" }).page === 1);
  check("every other field is preserved, not reset, when only one field changes", applyFilterChange(onPage3, { sort: "oldest" }).q === "old search");
}

// ---------------------------------------------------------------------------
console.log("\n[2] resetFilters() returns the pristine default state");
{
  const reset = resetFilters();
  check("reset matches DEFAULT_DISCOVERY_FILTERS exactly", JSON.stringify(reset) === JSON.stringify(DEFAULT_DISCOVERY_FILTERS));
  check("reset page is 1", reset.page === 1);
  check("reset sort is the documented backend default ('newest')", reset.sort === "newest");
}

// ---------------------------------------------------------------------------
console.log("\n[3] Search sends the correct `q` parameter to the backend");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });

  const filters = applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { q: "backend developer" });
  await listJobs(filters);

  check("q was sent exactly as typed", captured.params.q === "backend developer");
  check("page was reset to 1 in the actual request", captured.params.page === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[4] Empty search results are distinguishable from a request that hasn't run yet");
{
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE });
  const { jobs, pagination } = await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { q: "zzzznomatchzzzz" }));
  check("a genuine zero-match response returns an empty array, not null/undefined", Array.isArray(jobs) && jobs.length === 0);
  check("pagination.total reflects zero real matches", pagination.total === 0);
  check("pagination.totalPages is 0 for a genuinely empty result", pagination.totalPages === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[5] Experience filter sends the correct backend value");
{
  for (const level of ["fresher", "entry", "junior", "mid", "senior", "unknown"]) {
    let captured = null;
    apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
      captured = config;
    });
    await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { experience_level: level }));
    check(`experience_level=${level} sent exactly`, captured.params.experience_level === level);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[6] Technology filter sends the correct backend value");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { is_tech_relevant: "true" }));
  check("is_tech_relevant=true sent", captured.params.is_tech_relevant === "true");

  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { is_tech_relevant: "false" }));
  check("is_tech_relevant=false sent (a real filter value, not omitted)", captured.params.is_tech_relevant === "false");

  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { is_tech_relevant: "" }));
  check("'All jobs' (empty selection) omits the parameter entirely, not sending an empty string", !("is_tech_relevant" in captured.params));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Remote filter sends the correct backend value");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { is_remote: "true" }));
  check("is_remote=true sent", captured.params.is_remote === "true");

  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { is_remote: "false" }));
  check("is_remote=false sent (a real 'on-site' filter, not omitted)", captured.params.is_remote === "false");
}

// ---------------------------------------------------------------------------
console.log("\n[8] Location filter sends the correct backend parameter (free-text partial match, per BACKEND_API_CONTRACT.md §3)");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { location: "bangalore" }));
  check("the `location` (partial-match) param is used, not a fabricated exact city field", captured.params.location === "bangalore");
}

// ---------------------------------------------------------------------------
console.log("\n[9] Source filter sends the correct source value");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { source: "adzuna" }));
  check("source=adzuna sent", captured.params.source === "adzuna");

  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });
  await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { source: "remoteok" }));
  check("source=remoteok sent", captured.params.source === "remoteok");
}

// ---------------------------------------------------------------------------
console.log("\n[10] Multiple filters combine correctly into a single request");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
    captured = config;
  });

  let filters = DEFAULT_DISCOVERY_FILTERS;
  filters = applyFilterChange(filters, { q: "developer" });
  filters = applyFilterChange(filters, { experience_level: "junior" });
  filters = applyFilterChange(filters, { is_tech_relevant: "true" });
  filters = applyFilterChange(filters, { is_remote: "true" });
  filters = applyFilterChange(filters, { location: "India" });
  filters = applyFilterChange(filters, { source: "adzuna" });
  filters = applyFilterChange(filters, { sort: "newest" });

  await listJobs(filters);

  check("all 6 active filters + sort were sent together in one request", captured.params.q === "developer" && captured.params.experience_level === "junior" && captured.params.is_tech_relevant === "true" && captured.params.is_remote === "true" && captured.params.location === "India" && captured.params.source === "adzuna" && captured.params.sort === "newest");
  check("no extraneous/unrecognized keys were sent", Object.keys(captured.params).sort().join(",") === "experience_level,is_remote,is_tech_relevant,location,page,q,sort,source");
}

// ---------------------------------------------------------------------------
console.log("\n[11] Sorting sends the correct backend value");
{
  for (const sort of ["newest", "oldest", "salary_high"]) {
    let captured = null;
    apiClient.defaults.adapter = mockAdapter({ status: 200, data: EMPTY_LISTING_RESPONSE }, (config) => {
      captured = config;
    });
    await listJobs(applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { sort }));
    check(`sort=${sort} sent exactly`, captured.params.sort === sort);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[12] URL <-> filters conversion round-trips correctly");
{
  const filters = applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { q: "react", experience_level: "mid", page: 2 });
  const asParams = filtersToSearchParams(filters);

  check("q is present in the URL params", asParams.q === "react");
  check("experience_level is present", asParams.experience_level === "mid");
  check("a non-default page is present", asParams.page === "2");
  check("default-valued fields (sort='newest') are omitted from the URL for cleanliness", !("sort" in asParams));

  const roundTripped = searchParamsToFilters(asParams);
  check("q round-trips correctly", roundTripped.q === "react");
  check("experience_level round-trips correctly", roundTripped.experience_level === "mid");
  check("page round-trips as a real number, not a string", roundTripped.page === 2 && typeof roundTripped.page === "number");
  check("fields absent from the URL fall back to their defaults", roundTripped.source === "");
}

// ---------------------------------------------------------------------------
console.log("\n[13] searchParamsToFilters never crashes on garbage input");
{
  check("a non-numeric page falls back to the default", searchParamsToFilters({ page: "not-a-number" }).page === 1);
  check("a negative page falls back to the default", searchParamsToFilters({ page: "-5" }).page === 1);
  check("an empty object returns pure defaults", JSON.stringify(searchParamsToFilters({})) === JSON.stringify(DEFAULT_DISCOVERY_FILTERS));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
