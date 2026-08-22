// Deterministic verification for the Phase 1H-2 ingestion scheduler
// (backend/services/ingestionScheduler.js). No real cron interval is
// ever waited on: `runScheduledIngestion` (the exact function node-cron
// invokes on each real tick) is called directly, and
// `runAllSourcesIngestion` (Phase 1H-1) is stubbed via the scheduler's
// `deps` injection seam. No live HTTP calls, no MongoDB connection.
//
// Run via: node backend/scripts/testScheduler.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";

import {
  startIngestionScheduler,
  stopIngestionScheduler,
  runScheduledIngestion,
  getActiveTask,
  resolveSchedule,
  DEFAULT_CRON_SCHEDULE,
} from "../services/ingestionScheduler.js";

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

// Deferred-promise helper: lets a test control exactly when a mocked
// ingestion run "finishes", so two ticks can be started back-to-back
// without either one completing first.
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function cannedResult(overrides = {}) {
  return {
    startedAt: new Date(),
    finishedAt: new Date(),
    durationMs: 1,
    sources: [{ source: "adzuna" }, { source: "remoteok" }],
    totals: {
      fetchedCount: 5,
      normalizedCount: 5,
      rejectedCount: 0,
      classifiedCount: 5,
      insertedCount: 3,
      updatedCount: 2,
      skippedInvalidCount: 0,
      duplicateWarningCount: 0,
      failedCount: 0,
      sourcesFailed: 0,
    },
    ...overrides,
  };
}

console.log("============================");
console.log(" PHASE 1H-2 INGESTION SCHEDULER — DETERMINISTIC TESTS");
console.log(" (no real cron intervals, no live API calls, no MongoDB connection)");
console.log("============================");

// Make sure we start from a clean slate regardless of any earlier state.
stopIngestionScheduler();

// ---------------------------------------------------------------------------
console.log("\n[S1] Scheduler starts exactly once");
{
  const before = cron.getTasks().size;
  const task1 = startIngestionScheduler({ schedule: "*/10 * * * *" });
  const afterFirst = cron.getTasks().size;
  const task2 = startIngestionScheduler({ schedule: "*/1 * * * *" }); // different schedule requested — must still be ignored
  const afterSecond = cron.getTasks().size;

  check("first start actually registers one cron task", afterFirst === before + 1);
  check("second start call returns the SAME task instance (no-op)", task1 === task2);
  check("second start call does not register an additional task", afterSecond === afterFirst);
  check("the active task's pattern is still the first one requested (second call had no effect)", task1.getPattern() === "*/10 * * * *");

  stopIngestionScheduler();
  check("cleanup: task removed from node-cron's registry after stop", cron.getTasks().size === before);
}

// ---------------------------------------------------------------------------
console.log("\n[S2] The configured schedule is accepted and parsed correctly");
{
  check("a valid explicit schedule resolves to itself", resolveSchedule("*/15 * * * *") === "*/15 * * * *");

  const originalEnv = process.env.INGESTION_CRON_SCHEDULE;
  process.env.INGESTION_CRON_SCHEDULE = "*/20 * * * *";
  check("a valid env-configured schedule is honored when no explicit override is given", resolveSchedule() === "*/20 * * * *");
  delete process.env.INGESTION_CRON_SCHEDULE;

  check("with nothing configured, the documented safe default is used", resolveSchedule() === DEFAULT_CRON_SCHEDULE);
  check("the default schedule is itself a valid cron expression", cron.validate(DEFAULT_CRON_SCHEDULE) === true);

  const originalError = console.error;
  const capturedErrors = [];
  console.error = (...args) => capturedErrors.push(args.join(" "));
  const fallback = resolveSchedule("not a real cron expression");
  console.error = originalError;
  check("an invalid explicit schedule falls back to the safe default rather than crashing", fallback === DEFAULT_CRON_SCHEDULE);
  check("a fallback warning was logged (visible for ops, not silently swallowed)", capturedErrors.length === 1);

  if (originalEnv !== undefined) process.env.INGESTION_CRON_SCHEDULE = originalEnv;

  const task = startIngestionScheduler({ schedule: "*/30 * * * *" });
  check("the started task's actual pattern matches what was requested", task.getPattern() === "*/30 * * * *");
  stopIngestionScheduler();
}

// ---------------------------------------------------------------------------
console.log("\n[S3] The scheduler invokes the existing runAllSourcesIngestion function");
{
  let calls = 0;
  const spy = async () => {
    calls++;
    return cannedResult();
  };
  const result = await runScheduledIngestion({ runAllSourcesIngestion: spy });
  check("the injected runAllSourcesIngestion stand-in was invoked exactly once", calls === 1);
  check("its result is returned through unchanged", result.totals.insertedCount === 3);
}

// ---------------------------------------------------------------------------
console.log("\n[S4] A second tick is skipped while an ingestion run is still in progress");
{
  const first = deferred();
  let calls = 0;
  const slowSpy = async () => {
    calls++;
    return first.promise;
  };

  const run1Promise = runScheduledIngestion({ runAllSourcesIngestion: slowSpy });
  // Fired while run1 is still awaiting `first.promise` — must be skipped, not queued.
  const run2Result = await runScheduledIngestion({ runAllSourcesIngestion: slowSpy });

  check("the overlapping tick returns a clear 'skipped' result immediately", run2Result.skipped === true);
  check("the underlying ingestion function was NOT invoked a second time", calls === 1);

  first.resolve(cannedResult());
  const run1Result = await run1Promise;
  check("the original in-progress run still completes normally and returns its real result", run1Result.totals && run1Result.totals.insertedCount === 3);

  // Now that run1 has finished, a new tick must run normally again (not
  // permanently blocked by the earlier overlap).
  let calls2 = 0;
  const run3Result = await runScheduledIngestion({
    runAllSourcesIngestion: async () => {
      calls2++;
      return cannedResult();
    },
  });
  check("after the in-progress run finishes, the next tick runs normally (not stuck skipped)", calls2 === 1 && run3Result.skipped === undefined);
}

// ---------------------------------------------------------------------------
console.log("\n[S5] A failed ingestion run does not permanently disable future scheduled runs");
{
  const failingRun = await runScheduledIngestion({
    runAllSourcesIngestion: async () => {
      throw new Error("simulated unexpected orchestrator crash");
    },
  });
  check("the failure is captured, not thrown out of runScheduledIngestion", failingRun.error === "simulated unexpected orchestrator crash");

  let calls = 0;
  const nextRun = await runScheduledIngestion({
    runAllSourcesIngestion: async () => {
      calls++;
      return cannedResult();
    },
  });
  check("the very next tick still runs normally after a failure (not skipped, not permanently disabled)", calls === 1 && nextRun.skipped === undefined);
}

// ---------------------------------------------------------------------------
console.log("\n[S6] Scheduler stop prevents future scheduled executions");
{
  startIngestionScheduler({ schedule: "*/45 * * * *" });
  check("a task is active after start", getActiveTask() !== null);
  stopIngestionScheduler();
  check("no active task remains after stop", getActiveTask() === null);
  check("the task was fully removed from node-cron's own registry (not just paused)", cron.getTasks().size === 0);

  // Safe to call again with nothing active.
  let threw = false;
  try {
    stopIngestionScheduler();
  } catch {
    threw = true;
  }
  check("calling stop again with nothing active is a safe no-op", !threw);
}

// ---------------------------------------------------------------------------
console.log("\n[S7] Scheduler logging/results do not expose credentials or .env contents");
{
  const FAKE_SECRET = "sk_test_scheduler_secret_should_never_leak_1a2b3c";
  process.env.__SCHEDULER_TEST_FAKE_SECRET__ = FAKE_SECRET;

  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];
  console.log = (...args) => captured.push(args.join(" "));
  console.error = (...args) => captured.push(args.join(" "));

  let result;
  try {
    result = await runScheduledIngestion({
      runAllSourcesIngestion: async () => cannedResult(),
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    delete process.env.__SCHEDULER_TEST_FAKE_SECRET__;
  }

  const capturedText = captured.join("\n");
  const resultText = JSON.stringify(result);
  check("scheduler run-summary logging happened (not silent)", captured.length > 0);
  check("the fake secret never appears in any logged output", !capturedText.includes(FAKE_SECRET));
  check("the fake secret never appears anywhere in the returned result", !resultText.includes(FAKE_SECRET));
  check("logged summary contains only counts/names, not raw data", /fetched=\d+/.test(capturedText) && !/description/i.test(capturedText));
}

// ---------------------------------------------------------------------------
console.log("\n[S8] Starting the scheduler does not create a second MongoDB connection (static check)");
{
  const source = fs.readFileSync(path.resolve(__dirname, "../services/ingestionScheduler.js"), "utf8");
  check("scheduler source does not import mongoose", !/from\s+["']mongoose["']/.test(source));
  check("scheduler source never calls mongoose.connect(...)", !/mongoose\.connect\s*\(/.test(source));
  check("scheduler source never calls createConnection(...)", !/createConnection\s*\(/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[S9] The scheduler does not contain duplicated ingestion logic (static check)");
{
  const source = fs.readFileSync(path.resolve(__dirname, "../services/ingestionScheduler.js"), "utf8");
  check(
    "scheduler imports runAllSourcesIngestion from the existing Phase 1H-1 orchestrator",
    /import\s*{\s*runAllSourcesIngestion\s*}\s*from\s*["']\.\/ingestionOrchestrator\.js["']/.test(source)
  );
  check("scheduler never imports any Phase 1D adapter directly", !/adzunaAdapter|remoteOkAdapter/.test(source));
  check("scheduler never imports any Phase 1E normalizer directly", !/adzunaNormalizer|remoteOkNormalizer/.test(source));
  check("scheduler never imports the Phase 1F classifier directly", !/classifyJob\.js/.test(source));
  check("scheduler never imports the Phase 1G persistence layer directly", !/jobIngestionPipeline\.js|jobService\.js/.test(source));
  check("scheduler never imports the Job model directly", !/from\s+["'].*models\/Job\.js["']/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[S10] Existing Phase 1H-1 orchestrator tests still pass after this integration");
{
  // Re-import and smoke-check that the orchestrator module Phase 1H-2
  // depends on still exports exactly what Phase 1H-1 left it exporting —
  // the full 63-assertion suite itself is run separately (see the
  // report), this just confirms nothing about its public shape changed.
  const orchestratorModule = await import("../services/ingestionOrchestrator.js");
  check("runAllSourcesIngestion is still exported", typeof orchestratorModule.runAllSourcesIngestion === "function");
  check("runSourceIngestion is still exported", typeof orchestratorModule.runSourceIngestion === "function");
  check("APPROVED_SOURCES is still exported and unchanged", JSON.stringify(orchestratorModule.APPROVED_SOURCES) === JSON.stringify(["adzuna", "remoteok"]));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
