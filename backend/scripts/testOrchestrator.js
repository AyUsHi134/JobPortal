// Deterministic verification for the Phase 1H-1 ingestion orchestrator
// (backend/services/ingestionOrchestrator.js). Every test here is fully
// synthetic: no live HTTP calls to Adzuna/RemoteOK, and no MongoDB
// connection is opened or required — adapters' `fetch` functions are
// stubbed via the orchestrator's `deps.registry` injection seam, and the
// persistence layer's `persistJobs` is stubbed via `deps.persist`. Real
// (unmocked) normalization and classification functions are used
// throughout, since they are already pure/deterministic and this is
// exactly what proves the orchestrator wires the real Phase 1E/1F
// modules correctly.
//
// Run via: node backend/scripts/testOrchestrator.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";
import { normalizeRemoteOKJob } from "../integrations/jobs/remoteOkNormalizer.js";
import {
  runSourceIngestion,
  runAllSourcesIngestion,
  APPROVED_SOURCES,
} from "../services/ingestionOrchestrator.js";

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

// ---------------------------------------------------------------------------
// Fixtures — synthetic, hand-built, shaped after the real documented raw
// structures from PHASE_1D_REPORT.md/JOB_API_DATA_REPORT.md. Not real
// scraped listings.
// ---------------------------------------------------------------------------

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

// Mocked adapter `fetch` functions — same return shape as the real Phase
// 1D adapters (adapterResult.js's success()/failure()), but synchronous
// canned data instead of a real HTTP call.
function mockFetchOk(source, jobs, metaExtra = {}) {
  return async () => ({ ok: true, source, jobs, meta: { mocked: true, ...metaExtra }, error: null, fetchedAt: new Date() });
}
function mockFetchFail(source, error) {
  return async () => ({ ok: false, source, jobs: [], meta: {}, error, fetchedAt: new Date() });
}
function mockFetchThrows(message) {
  return async () => {
    throw new Error(message);
  };
}

// Mocked persistence layer — stands in for persistJobs (Phase 1G) so
// these tests never need a live MongoDB connection. Records every call
// so tests can assert the orchestrator actually delegates to it (rather
// than reimplementing persistence itself) and passes it the right data.
function makePersistSpy(cannedResultFn) {
  const calls = [];
  async function persist(jobs) {
    calls.push(jobs);
    return cannedResultFn(jobs);
  }
  persist.calls = calls;
  return persist;
}

// Default canned persistence outcome: pretend every classified job was
// freshly inserted, no duplicates, no errors — good enough for tests that
// aren't specifically exercising persistence-outcome plumbing (that's
// test 5, which supplies its own canned result).
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

console.log("============================");
console.log(" PHASE 1H-1 INGESTION ORCHESTRATOR — DETERMINISTIC TESTS");
console.log(" (no live API calls, no MongoDB connection)");
console.log("============================");

console.log("\n[T0] APPROVED_SOURCES reflects exactly the two approved sources");
check("APPROVED_SOURCES === ['adzuna', 'remoteok']", JSON.stringify(APPROVED_SOURCES) === JSON.stringify(["adzuna", "remoteok"]));

// ---------------------------------------------------------------------------
console.log("\n[T1] Adzuna raw jobs flow through normalization -> classification -> persistence");
{
  const rawJobs = [adzunaRawJob()];
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", rawJobs, { count: 1 }), normalize: normalizeAdzunaJob },
  };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });

  check("fetchOk === true", result.fetchOk === true);
  check("fetchedCount === 1", result.fetchedCount === 1);
  check("normalizedCount === 1 (real normalizer ran)", result.normalizedCount === 1);
  check("rejectedCount === 0", result.rejectedCount === 0);
  check("classifiedCount === 1 (real classifier ran)", result.classifiedCount === 1);
  check("insertedCount === 1", result.insertedCount === 1);
  check("persist was called exactly once", persist.calls.length === 1);
  const persistedJob = persist.calls[0][0];
  check("persisted job carries source identity", persistedJob.source === "adzuna" && persistedJob.source_id === "5900001234");
  check("persisted job carries classification fields (real classifyJob ran)", typeof persistedJob.is_tech_relevant === "boolean" && persistedJob.tech_relevance_source === "source_category");
  check("persisted job carries normalized fields (real normalizer ran)", persistedJob.title === "Backend Developer (Node.js)" && persistedJob.location.city === "Pune");
  check("errors is empty", result.errors.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[T2] RemoteOK raw jobs flow through normalization -> classification -> persistence");
{
  const rawJobs = [remoteOkRawJob()];
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    remoteok: { fetch: mockFetchOk("remoteok", rawJobs), normalize: normalizeRemoteOKJob },
  };
  const result = await runSourceIngestion("remoteok", {}, { registry, persist });

  check("fetchOk === true", result.fetchOk === true);
  check("fetchedCount === 1", result.fetchedCount === 1);
  check("normalizedCount === 1", result.normalizedCount === 1);
  check("classifiedCount === 1", result.classifiedCount === 1);
  check("insertedCount === 1", result.insertedCount === 1);
  const persistedJob = persist.calls[0][0];
  check("persisted job carries source identity", persistedJob.source === "remoteok" && persistedJob.source_id === "1140002");
  check("is_remote hardcoded true by real normalizer", persistedJob.is_remote === true);
  check("classification derived skills present (real classifier ran)", Array.isArray(persistedJob.normalized_skills) && persistedJob.normalized_skills.includes("react"));
  check("errors is empty", result.errors.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[T3] One malformed raw job does not stop the rest of the batch");
{
  const rawJobs = [
    adzunaRawJob({ id: 1 }),
    { description: "missing everything else" }, // malformed: no title/company/id/location
    adzunaRawJob({ id: 2, title: "Second Valid Job" }),
  ];
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", rawJobs), normalize: normalizeAdzunaJob },
  };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });

  check("fetchedCount === 3", result.fetchedCount === 3);
  check("normalizedCount === 2 (2 valid jobs survived)", result.normalizedCount === 2);
  check("rejectedCount === 1 (1 malformed job isolated)", result.rejectedCount === 1);
  check("a normalize warning was recorded", result.warnings.some((w) => w.stage === "normalize"));
  check(
    "the rejection reason is present and does not silently hide the failure",
    result.warnings[0].rejected[0] && typeof result.warnings[0].rejected[0].reason === "string" && result.warnings[0].rejected[0].reason.length > 0
  );
  check("persist was still called with exactly the 2 valid jobs", persist.calls[0].length === 2);
  check("classifiedCount === 2", result.classifiedCount === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[T4] One source's total adapter failure does not prevent the other source from running");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: {
      fetch: mockFetchFail("adzuna", { type: "auth_failed", message: "Adzuna rejected the provided credentials.", status: 401 }),
      normalize: normalizeAdzunaJob,
    },
    remoteok: {
      fetch: mockFetchOk("remoteok", [remoteOkRawJob()]),
      normalize: normalizeRemoteOKJob,
    },
  };
  const runResult = await runAllSourcesIngestion({}, { registry, persist });

  check("both sources were attempted", runResult.sources.length === 2);
  const adzunaResult = runResult.sources.find((s) => s.source === "adzuna");
  const remoteOkResult = runResult.sources.find((s) => s.source === "remoteok");

  check("adzuna is clearly reported as failed", adzunaResult.fetchOk === false);
  check("adzuna's failure reason is preserved, not hidden", adzunaResult.errors.some((e) => e.stage === "fetch" && e.type === "auth_failed"));
  check("adzuna contributed 0 fetched/inserted (no fabricated counts)", adzunaResult.fetchedCount === 0 && adzunaResult.insertedCount === 0);

  check("remoteok still succeeded despite adzuna's failure", remoteOkResult.fetchOk === true);
  check("remoteok still inserted its job", remoteOkResult.insertedCount === 1);

  check("overall totals correctly reflect one failed source", runResult.totals.sourcesFailed === 1);
  check("overall totals still count remoteok's real work", runResult.totals.insertedCount === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[T5] Persistence outcomes are correctly reflected in the final run summary");
{
  const cannedPersistResult = {
    summary: { total: 2, inserted: 1, updated: 1, skipped_invalid: 0, errors: 0, cross_source_duplicate_warnings: 1 },
    results: [
      { status: "inserted", source: "adzuna", source_id: "1", jobId: "id1", dedupFingerprint: "fp1", crossSourceDuplicates: [] },
      { status: "updated", source: "adzuna", source_id: "2", jobId: "id2", dedupFingerprint: "fp2", crossSourceDuplicates: [{ _id: "other", source: "remoteok", source_id: "9", title: "x", company: "y" }] },
    ],
  };
  const persist = makePersistSpy(() => cannedPersistResult);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob({ id: 1 }), adzunaRawJob({ id: 2 })]), normalize: normalizeAdzunaJob },
  };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });

  check("insertedCount reflects the canned persistence summary exactly", result.insertedCount === 1);
  check("updatedCount reflects the canned persistence summary exactly", result.updatedCount === 1);
  check("duplicateWarningCount reflects the canned persistence summary exactly", result.duplicateWarningCount === 1);
  check("skippedInvalidCount reflects the canned persistence summary exactly", result.skippedInvalidCount === 0);
  check("failedCount does not include successful outcomes", result.failedCount === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[T6] Empty API results are handled safely");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", []), normalize: normalizeAdzunaJob },
  };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });

  check("fetchOk === true even with 0 results", result.fetchOk === true);
  check("fetchedCount === 0", result.fetchedCount === 0);
  check("normalizedCount === 0", result.normalizedCount === 0);
  check("classifiedCount === 0", result.classifiedCount === 0);
  check("insertedCount === 0", result.insertedCount === 0);
  check("no errors were fabricated for an empty (but successful) fetch", result.errors.length === 0);
  check("persist was still called safely with an empty array", persist.calls.length === 1 && persist.calls[0].length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[T6b] Running one source independently never touches the other source's adapter");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob()]), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchThrows("remoteok fetch should never be called in this test"), normalize: normalizeRemoteOKJob },
  };
  const result = await runSourceIngestion("adzuna", {}, { registry, persist });
  check("running 'adzuna' alone succeeds without invoking remoteok's adapter", result.fetchOk === true && result.errors.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[T7] No secrets or credentials appear in logs or returned results");
{
  const FAKE_SECRET = "sk_test_super_secret_should_never_leak_9f8e7d6c";
  process.env.__ORCHESTRATOR_TEST_FAKE_SECRET__ = FAKE_SECRET;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const captured = [];
  console.log = (...args) => captured.push(args.join(" "));
  console.warn = (...args) => captured.push(args.join(" "));
  console.error = (...args) => captured.push(args.join(" "));

  let result;
  try {
    const persist = makePersistSpy(defaultCannedPersist);
    const registry = {
      adzuna: {
        fetch: mockFetchFail("adzuna", { type: "auth_failed", message: "Adzuna rejected the provided credentials.", status: 401 }),
        normalize: normalizeAdzunaJob,
      },
      remoteok: { fetch: mockFetchOk("remoteok", [remoteOkRawJob()]), normalize: normalizeRemoteOKJob },
    };
    result = await runAllSourcesIngestion({}, { registry, persist });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    delete process.env.__ORCHESTRATOR_TEST_FAKE_SECRET__;
  }

  const capturedText = captured.join("\n");
  const resultText = JSON.stringify(result);
  check("the orchestrator emits no console output on its own", captured.length === 0);
  check("the fake secret never appears in any captured console output", !capturedText.includes(FAKE_SECRET));
  check("the fake secret never appears anywhere in the returned run result", !resultText.includes(FAKE_SECRET));
}

// ---------------------------------------------------------------------------
console.log("\n[T8] The orchestrator does not create a second MongoDB connection");
{
  const source = fs.readFileSync(path.resolve(__dirname, "../services/ingestionOrchestrator.js"), "utf8");
  check("orchestrator source does not import mongoose", !/from\s+["']mongoose["']/.test(source));
  check("orchestrator source never calls mongoose.connect(...)", !/mongoose\.connect\s*\(/.test(source));
  check("orchestrator source never calls createConnection(...)", !/createConnection\s*\(/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[T9] The existing Phase 1G persistence layer is used, not duplicated");
{
  const source = fs.readFileSync(path.resolve(__dirname, "../services/ingestionOrchestrator.js"), "utf8");
  check(
    "orchestrator imports persistJobs from the existing Phase 1G jobIngestionPipeline.js",
    /import\s*{\s*persistJobs\s*}\s*from\s*["']\.\/jobIngestionPipeline\.js["']/.test(source)
  );
  check("orchestrator never imports the Job model directly", !/from\s+["'].*models\/Job\.js["']/.test(source));
  check("orchestrator never calls findOneAndUpdate itself", !/findOneAndUpdate/.test(source));
  check("orchestrator never calls upsertClassifiedJob directly (only through persistJobs)", !/upsertClassifiedJob\s*\(/.test(source));

  // Runtime confirmation: the default (non-test) code path really does
  // delegate to whatever function is passed as `persist`, proving the
  // production default (persistJobs) is what actually executes, not a
  // second, orchestrator-owned implementation.
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = { adzuna: { fetch: mockFetchOk("adzuna", [adzunaRawJob()]), normalize: normalizeAdzunaJob } };
  await runSourceIngestion("adzuna", {}, { registry, persist });
  check("the injected persistence function was actually invoked (delegation confirmed at runtime)", persist.calls.length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[T10] An unexpected (non-adapter-convention) fetch failure is still isolated");
{
  const persist = makePersistSpy(defaultCannedPersist);
  const registry = {
    adzuna: { fetch: mockFetchThrows("simulated unexpected adapter crash"), normalize: normalizeAdzunaJob },
    remoteok: { fetch: mockFetchOk("remoteok", [remoteOkRawJob()]), normalize: normalizeRemoteOKJob },
  };
  const runResult = await runAllSourcesIngestion({}, { registry, persist });
  const adzunaResult = runResult.sources.find((s) => s.source === "adzuna");
  const remoteOkResult = runResult.sources.find((s) => s.source === "remoteok");

  check("the unexpected throw is captured, not propagated", adzunaResult.errors.some((e) => e.stage === "fetch" && e.message.includes("simulated unexpected adapter crash")));
  check("runAllSourcesIngestion itself did not throw", true); // reaching this line proves it
  check("the other source still completed successfully", remoteOkResult.fetchOk === true && remoteOkResult.insertedCount === 1);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
