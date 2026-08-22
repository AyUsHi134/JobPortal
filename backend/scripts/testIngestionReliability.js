// Deterministic verification for Phase 1H-3 ingestion reliability and
// run-tracking behavior: the existing Phase 1H-1 orchestrator run-result
// structure, source-failure isolation, the new bounded retry/backoff
// helper (backend/services/ingestionReliability.js), and Phase 1H-2
// scheduler failure containment/overlap protection remaining intact
// after this phase's change. No real cron interval is waited on, no
// live HTTP calls are made, and no MongoDB connection is opened — every
// adapter fetch and persistence call is stubbed via the existing
// deps.registry/deps.persist injection seams; retry backoff delays are
// stubbed via ingestionReliability's injectable `sleep` option.
//
// Run via: node backend/scripts/testIngestionReliability.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";
import { normalizeRemoteOKJob } from "../integrations/jobs/remoteOkNormalizer.js";
import { runSourceIngestion, runAllSourcesIngestion } from "../services/ingestionOrchestrator.js";
import { withRetry, isRetryableError, DEFAULT_MAX_ATTEMPTS } from "../services/ingestionReliability.js";
import { runScheduledIngestion, startIngestionScheduler, stopIngestionScheduler } from "../services/ingestionScheduler.js";

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

function adzunaRawJob(overrides = {}) {
  return {
    id: 5900001234,
    title: "Backend Developer (Node.js)",
    company: { display_name: "Brightline Systems Pvt Ltd" },
    description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
    redirect_url: "https://www.adzuna.in/land/ad/5900001234",
    location: { display_name: "Pune, Maharashtra", area: ["India", "Maharashtra", "Pune"] },
    salary_min: 800000,
    salary_max: 1200000,
    salary_is_predicted: "0",
    contract_time: "full_time",
    category: { label: "IT Jobs" },
    created: "2026-08-10T09:15:00Z",
    ...overrides,
  };
}

function remoteOkRawJob(overrides = {}) {
  return {
    id: 1140002,
    slug: "remote-senior-react-engineer",
    position: "Senior React Engineer",
    company: "Nimbus Cloud Labs",
    description: "We're hiring a remote Senior React Engineer to help build our dashboard product.",
    apply_url: "https://remoteok.com/remote-jobs/x",
    location: "Berlin, Germany",
    tags: ["react", "javascript", "frontend", "full time"],
    salary_min: 90000,
    salary_max: 130000,
    date: "2026-08-14T12:49:18Z",
    logo: "",
    ...overrides,
  };
}

function mockFetchOk(source, jobs, metaExtra = {}) {
  return async () => ({ ok: true, source, jobs, meta: { mocked: true, ...metaExtra }, error: null, fetchedAt: new Date() });
}
function mockFetchFail(source, error) {
  return async () => ({ ok: false, source, jobs: [], meta: {}, error, fetchedAt: new Date() });
}

function makePersistSpy(cannedResultFn) {
  const calls = [];
  async function persist(jobs) {
    calls.push(jobs);
    return cannedResultFn(jobs);
  }
  persist.calls = calls;
  return persist;
}

function defaultCannedPersist(jobs) {
  return {
    summary: {
      total: jobs.length,
      inserted: jobs.length,
      updated: 0,
      skipped_invalid: 0,
      errors: 0,
      cross_source_duplicate_warnings: 0,
    },
    results: jobs.map((j) => ({
      status: "inserted",
      source: j.source,
      source_id: j.source_id,
      jobId: `fake-id-${j.source_id}`,
      dedupFingerprint: "fake-fingerprint",
      crossSourceDuplicates: [],
    })),
  };
}

// A "fetch" that fails N times with a given error, then succeeds (or
// keeps failing if N >= call budget) — used to exercise retry behavior
// deterministically, with an injectable no-op sleep so no real delay
// ever occurs in this test run.
function makeFlakyFetch(source, jobs, failuresBeforeSuccess, error) {
  let calls = 0;
  return async () => {
    calls++;
    if (calls <= failuresBeforeSuccess) {
      return { ok: false, source, jobs: [], meta: {}, error, fetchedAt: new Date() };
    }
    return { ok: true, source, jobs, meta: { mocked: true }, error: null, fetchedAt: new Date() };
  };
}

function noopSleepRecorder() {
  const delays = [];
  const sleep = async (ms) => {
    delays.push(ms);
  };
  sleep.delays = delays;
  return sleep;
}

console.log("============================");
console.log(" PHASE 1H-3 INGESTION RELIABILITY — DETERMINISTIC TESTS");
console.log(" (no real cron intervals, no live API calls, no MongoDB connection)");
console.log("============================");

stopIngestionScheduler();

// ---------------------------------------------------------------------------
console.log("\n[R1] Successful run produces a complete, structured run summary");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob()], { count: 1 }), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchOk("remoteok", [remoteOkRawJob()]), normalize: normalizeRemoteOKJob },
  };
  const result = await runAllSourcesIngestion({}, { registry, persist });

  check("startedAt/finishedAt/durationMs are present", result.startedAt instanceof Date && result.finishedAt instanceof Date && typeof result.durationMs === "number");
  check("both sources were attempted", result.sources.length === 2 && result.sources.every((s) => ["adzuna", "remoteok"].includes(s.source)));
  for (const s of result.sources) {
    check(`${s.source}: source-level success is clear (fetchOk)`, s.fetchOk === true);
    check(`${s.source}: fetched/normalized/classified/inserted counts are all populated`, s.fetchedCount === 1 && s.normalizedCount === 1 && s.classifiedCount === 1 && s.insertedCount === 1);
    check(`${s.source}: duration is tracked per source too`, typeof s.durationMs === "number");
  }
  check("totals aggregate correctly across both sources", result.totals.fetchedCount === 2 && result.totals.insertedCount === 2 && result.totals.sourcesFailed === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[R2] Adzuna-only failure: RemoteOK still runs and its results are preserved");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchFail("adzuna", { type: "auth_failed", message: "Adzuna rejected the provided credentials.", status: 401 }), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchOk("remoteok", [remoteOkRawJob()]), normalize: normalizeRemoteOKJob },
  };
  const result = await runAllSourcesIngestion({}, { registry, persist });
  const adzuna = result.sources.find((s) => s.source === "adzuna");
  const remoteok = result.sources.find((s) => s.source === "remoteok");

  check("adzuna is clearly marked failed", adzuna.fetchOk === false && adzuna.errors.some((e) => e.stage === "fetch" && e.type === "auth_failed"));
  check("adzuna's failure does not fabricate any counts", adzuna.fetchedCount === 0 && adzuna.insertedCount === 0);
  check("remoteok still fully succeeded", remoteok.fetchOk === true && remoteok.insertedCount === 1);
  check("overall totals reflect exactly one failed source, not a crashed run", result.totals.sourcesFailed === 1 && result.totals.insertedCount === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[R3] RemoteOK-only failure: Adzuna's successful results are preserved");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob()]), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchFail("remoteok", { type: "network_error", message: "Network error while contacting RemoteOK.", code: "ECONNRESET" }), normalize: normalizeRemoteOKJob },
  };
  const result = await runAllSourcesIngestion({}, { registry, persist });
  const adzuna = result.sources.find((s) => s.source === "adzuna");
  const remoteok = result.sources.find((s) => s.source === "remoteok");

  check("remoteok is clearly marked failed", remoteok.fetchOk === false && remoteok.errors.some((e) => e.stage === "fetch" && e.type === "network_error"));
  check("adzuna's successful results are fully preserved", adzuna.fetchOk === true && adzuna.insertedCount === 1);
  check("overall totals reflect exactly one failed source", result.totals.sourcesFailed === 1 && result.totals.insertedCount === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[R4] Both sources failing finishes with a clear failed/partial result, not a crash");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchFail("adzuna", { type: "timeout", message: "Request to Adzuna timed out." }), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchFail("remoteok", { type: "http_error", message: "RemoteOK returned an unexpected HTTP status.", status: 503 }), normalize: normalizeRemoteOKJob },
  };
  let threw = false;
  let result;
  try {
    result = await runAllSourcesIngestion({}, { registry, persist });
  } catch {
    threw = true;
  }
  check("runAllSourcesIngestion does not throw even when every source fails", !threw);
  check("both sources are clearly reported as failed", result.totals.sourcesFailed === 2);
  check("no counts are fabricated when everything failed", result.totals.fetchedCount === 0 && result.totals.insertedCount === 0);
  check("persist was never called (nothing valid to persist)", persist.calls.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[R5] Malformed-job rejection is reflected in the run summary");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const rawJobs = [adzunaRawJob({ id: 1 }), { description: "missing everything else" }, adzunaRawJob({ id: 2 })];
  const registry = { adzuna: { fetch: mockFetchOk("adzuna", rawJobs), normalize: normalizeAdzunaJob } };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });

  check("rejectedCount reflects the one malformed job", result.rejectedCount === 1);
  check("normalizedCount reflects only the 2 valid jobs", result.normalizedCount === 2);
  check("the rejection is visible in warnings with a real reason", result.warnings.some((w) => w.stage === "normalize" && w.rejected[0].reason.length > 0));
  check("failedCount includes the rejected job", result.failedCount >= 1);
}

// ---------------------------------------------------------------------------
console.log("\n[R6] Persistence failures are reported without crashing the entire run");
{
  const registry = { adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob({ id: 1 }), adzunaRawJob({ id: 2 })]), normalize: normalizeAdzunaJob } };

  // (a) persistJobs itself throws unexpectedly (e.g. DB unavailable).
  const throwingPersist = async () => {
    throw new Error("simulated MongoDB unavailable");
  };
  const resultA = await runSourceIngestion("adzuna", {}, { registry, persist: throwingPersist });
  check("an unexpected persist-layer exception is captured, not thrown", resultA.errors.some((e) => e.stage === "persist" && e.message === "simulated MongoDB unavailable"));

  // (b) persistJobs returns normally but reports a per-job error (the
  // realistic Phase 1G behavior for a single bad job in a batch).
  const partialFailurePersist = async (jobs) => ({
    summary: { total: jobs.length, inserted: jobs.length - 1, updated: 0, skipped_invalid: 0, errors: 1, cross_source_duplicate_warnings: 0 },
    results: [
      { status: "inserted", source: jobs[0].source, source_id: jobs[0].source_id, jobId: "id1", dedupFingerprint: "fp1", crossSourceDuplicates: [] },
      { status: "error", source: jobs[1].source, source_id: jobs[1].source_id, jobId: null, dedupFingerprint: null, crossSourceDuplicates: [], reason: "simulated validation error" },
    ],
  });
  const resultB = await runSourceIngestion("adzuna", {}, { registry, persist: partialFailurePersist });
  check("a per-job persistence error is surfaced in errors[] with its reason", resultB.errors.some((e) => e.stage === "persist" && e.message === "simulated validation error"));
  check("the other job in the same batch still counts as inserted", resultB.insertedCount === 1);
  check("failedCount reflects the persistence error", resultB.failedCount >= 1);
}

// ---------------------------------------------------------------------------
console.log("\n[R7] Retry/backoff: a transient failure is retried once, then succeeds");
{
  const sleep = noopSleepRecorder();
  const flaky = makeFlakyFetch("adzuna", [adzunaRawJob()], 1, { type: "network_error", message: "Network error while contacting Adzuna.", code: "ETIMEDOUT" });
  const retrying = withRetry(flaky, { sleep });

  const result = await retrying();
  check("the retried fetch eventually succeeds", result.ok === true);
  check("meta.attempts records exactly 2 attempts (1 failure + 1 success)", result.meta.attempts === 2);
  check("exactly one backoff delay occurred", sleep.delays.length === 1);
  check("the adapter's own meta is preserved alongside attempts", result.meta.mocked === true);
}

console.log("\n[R8] Retry/backoff: a non-transient failure (auth) is never retried");
{
  const sleep = noopSleepRecorder();
  let calls = 0;
  const alwaysAuthFail = async () => {
    calls++;
    return { ok: false, source: "adzuna", jobs: [], meta: {}, error: { type: "auth_failed", message: "bad creds", status: 401 }, fetchedAt: new Date() };
  };
  const retrying = withRetry(alwaysAuthFail, { sleep });
  const result = await retrying();

  check("auth_failed is correctly classified as non-retryable", isRetryableError({ type: "auth_failed" }) === false);
  check("the wrapped fetch was called exactly once (no retry attempted)", calls === 1);
  check("no backoff delay occurred", sleep.delays.length === 0);
  check("the failure is still returned faithfully, with attempts=1", result.ok === false && result.error.type === "auth_failed" && result.meta.attempts === 1);
}

console.log("\n[R9] Retry/backoff: retries are bounded and eventually give up");
{
  const sleep = noopSleepRecorder();
  let calls = 0;
  const alwaysTimesOut = async () => {
    calls++;
    return { ok: false, source: "adzuna", jobs: [], meta: {}, error: { type: "timeout", message: "Request to Adzuna timed out." }, fetchedAt: new Date() };
  };
  const retrying = withRetry(alwaysTimesOut, { sleep });
  const result = await retrying();

  check(`retries are bounded to DEFAULT_MAX_ATTEMPTS (${DEFAULT_MAX_ATTEMPTS})`, calls === DEFAULT_MAX_ATTEMPTS);
  check("a persistently-failing transient error still ultimately returns a clear failure (not an infinite loop)", result.ok === false && result.error.type === "timeout");
  check("backoff delay count is one less than attempts (no wait after the final attempt)", sleep.delays.length === DEFAULT_MAX_ATTEMPTS - 1);
}

console.log("\n[R10] Retry/backoff: a 5xx http_error is retryable, a 4xx is not");
{
  check("a 500 http_error is retryable", isRetryableError({ type: "http_error", status: 500 }) === true);
  check("a 503 http_error is retryable", isRetryableError({ type: "http_error", status: 503 }) === true);
  check("a 404 http_error is NOT retryable", isRetryableError({ type: "http_error", status: 404 }) === false);
  check("a malformed_response is NOT retryable", isRetryableError({ type: "malformed_response" }) === false);
  check("missing_credentials is NOT retryable", isRetryableError({ type: "missing_credentials" }) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[R11] Retry wrapping is actually applied in the orchestrator's production registry (static check)");
{
  const source = fs.readFileSync(path.resolve(__dirname, "../services/ingestionOrchestrator.js"), "utf8");
  check("orchestrator imports withRetry from the new reliability module", /import\s*{\s*withRetry\s*}\s*from\s*["']\.\/ingestionReliability\.js["']/.test(source));
  check("adzuna's production fetch is wrapped with withRetry(...)", /adzuna:\s*{\s*fetch:\s*withRetry\(fetchAdzunaJobs\)/.test(source));
  check("remoteok's production fetch is wrapped with withRetry(...)", /remoteok:\s*{\s*fetch:\s*withRetry\(fetchRemoteOKJobs\)/.test(source));
  check("runSourceIngestion's control flow itself is untouched by this phase (no retry logic inlined there)", !/for\s*\(.*attempt/i.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[R12] Scheduler continues after a failed run (regression, still intact after this phase's change)");
{
  const failing = await runScheduledIngestion({
    runAllSourcesIngestion: async () => {
      throw new Error("simulated unexpected orchestrator crash");
    },
  });
  check("the failure is captured, not thrown out of the scheduler tick", failing.error === "simulated unexpected orchestrator crash");

  let calls = 0;
  const nextTick = await runScheduledIngestion({
    runAllSourcesIngestion: async () => {
      calls++;
      return { startedAt: new Date(), finishedAt: new Date(), durationMs: 1, sources: [], totals: { insertedCount: 0 } };
    },
  });
  check("the very next tick still runs normally after a failure", calls === 1 && nextTick.skipped === undefined);
}

// ---------------------------------------------------------------------------
console.log("\n[R13] Overlap protection remains intact after this phase's change (regression)");
{
  let resolveFirst;
  let calls = 0;
  const slow = async () => {
    calls++;
    return new Promise((resolve) => {
      resolveFirst = () => resolve({ startedAt: new Date(), finishedAt: new Date(), durationMs: 1, sources: [], totals: { insertedCount: 0 } });
    });
  };

  const run1 = runScheduledIngestion({ runAllSourcesIngestion: slow });
  const run2Result = await runScheduledIngestion({ runAllSourcesIngestion: slow });

  check("a tick fired while a run is in-flight is skipped, not run concurrently", run2Result.skipped === true);
  check("the underlying ingestion function was invoked only once", calls === 1);

  resolveFirst();
  await run1;
}

// ---------------------------------------------------------------------------
console.log("\n[R14] No secrets or credentials appear in logs or returned results (including retry paths)");
{
  const FAKE_SECRET = "sk_test_reliability_secret_should_never_leak_7d8e9f";
  process.env.__RELIABILITY_TEST_FAKE_SECRET__ = FAKE_SECRET;

  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];
  console.log = (...args) => captured.push(args.join(" "));
  console.error = (...args) => captured.push(args.join(" "));

  let result;
  try {
    const sleep = noopSleepRecorder();
    const persist = makePersistSpy(defaultCannedPersist);
    const registry = {
      adzuna: {
        fetch: withRetry(
          makeFlakyFetch("adzuna", [adzunaRawJob()], 1, { type: "network_error", message: "Network error while contacting Adzuna." }),
          { sleep }
        ),
        normalize: normalizeAdzunaJob,
      },
      remoteok: { fetch: mockFetchFail("remoteok", { type: "auth_failed", message: "bad creds", status: 401 }), normalize: normalizeRemoteOKJob },
    };
    result = await runAllSourcesIngestion({}, { registry, persist });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    delete process.env.__RELIABILITY_TEST_FAKE_SECRET__;
  }

  const capturedText = captured.join("\n");
  const resultText = JSON.stringify(result);
  check("the fake secret never appears in any captured console output", !capturedText.includes(FAKE_SECRET));
  check("the fake secret never appears anywhere in the returned run result", !resultText.includes(FAKE_SECRET));
  check("the run result contains no raw job description text (only counts/short summaries)", !resultText.includes("We are looking for a Backend Developer"));
}

// ---------------------------------------------------------------------------
console.log("\n[R15] Existing Phase 1H-1/1H-2 exports are unchanged after this phase's integration");
{
  const orchestratorModule = await import("../services/ingestionOrchestrator.js");
  const schedulerModule = await import("../services/ingestionScheduler.js");
  check("runAllSourcesIngestion still exported", typeof orchestratorModule.runAllSourcesIngestion === "function");
  check("runSourceIngestion still exported", typeof orchestratorModule.runSourceIngestion === "function");
  check("APPROVED_SOURCES unchanged", JSON.stringify(orchestratorModule.APPROVED_SOURCES) === JSON.stringify(["adzuna", "remoteok"]));
  check("startIngestionScheduler/stopIngestionScheduler still exported", typeof schedulerModule.startIngestionScheduler === "function" && typeof schedulerModule.stopIngestionScheduler === "function");
  check("scheduler default schedule is unchanged (still every 6 hours)", schedulerModule.DEFAULT_CRON_SCHEDULE === "0 */6 * * *");
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
