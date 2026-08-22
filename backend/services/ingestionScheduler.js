import cron from "node-cron";
import { runAllSourcesIngestion } from "./ingestionOrchestrator.js";

/**
 * Phase 1H-2 ingestion scheduler.
 *
 * Wraps the existing Phase 1H-1 orchestrator (`runAllSourcesIngestion`)
 * with a recurring cron schedule. Contains NO fetching, normalization,
 * classification, deduplication, or persistence logic of its own — every
 * ingestion concern is delegated entirely to the orchestrator, which is
 * used exactly as-is (see PHASE_1H1_REPORT.md). This file only decides
 * WHEN to run it and guards against overlapping runs.
 *
 * Uses whatever MongoDB connection is already open by the time
 * startIngestionScheduler() is called (see backend/index.js's startup
 * sequence) — this module never imports mongoose and never opens a
 * connection of its own.
 */

// Adzuna's free tier is reported by third-party sources (unverified in
// Adzuna's own docs — see JOB_API_DATA_REPORT.md) at roughly 1,000 calls/
// month (~33/day). Each ingestion run currently makes at most one Adzuna
// call (the orchestrator/adapter fetch one page per run; no pagination
// loop exists yet — PHASE_1H1_REPORT.md §11). Every 6 hours = 4 runs/day,
// comfortably inside that budget with real headroom left for occasional
// manual/dev runs on top. RemoteOK has no published limit ("please don't
// abuse" per JOB_API_DATA_REPORT.md) and is called at the same cadence.
// This is deliberately conservative, not tuned for maximum freshness —
// see PHASE_1H2_REPORT.md §3 for the full reasoning and how to override
// it via INGESTION_CRON_SCHEDULE.
const DEFAULT_CRON_SCHEDULE = "0 */6 * * *";
const TASK_NAME = "job-ingestion-scheduler";

let activeTask = null;
let isRunning = false;

// Falls back to the safe default (rather than throwing/crashing backend
// startup) if INGESTION_CRON_SCHEDULE or an explicit override is not a
// valid cron expression — a misconfigured env var should never take the
// whole backend down.
function resolveSchedule(explicitSchedule) {
  const candidate = explicitSchedule || process.env.INGESTION_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;
  if (cron.validate(candidate)) return candidate;
  console.error(
    `[ingestion-scheduler] "${candidate}" is not a valid cron expression — falling back to the default schedule "${DEFAULT_CRON_SCHEDULE}".`
  );
  return DEFAULT_CRON_SCHEDULE;
}

// Only ever logs counts/durations/source names — never raw API
// responses, job descriptions, or anything from process.env.
function logRunSummary(result) {
  if (!result || !Array.isArray(result.sources)) {
    console.log("[ingestion-scheduler] run completed with no summarizable result.");
    return;
  }
  const t = result.totals || {};
  const sourceNames = result.sources.map((s) => s.source).join(", ");
  console.log(
    `[ingestion-scheduler] run finished in ${result.durationMs}ms — sources attempted: [${sourceNames}], ` +
      `fetched=${t.fetchedCount ?? 0}, inserted=${t.insertedCount ?? 0}, updated=${t.updatedCount ?? 0}, ` +
      `rejected=${t.rejectedCount ?? 0}, failed=${t.failedCount ?? 0}, sourcesFailed=${t.sourcesFailed ?? 0}`
  );
}

/**
 * The actual per-tick work. Exported so deterministic tests can invoke it
 * directly — with a stubbed `deps.runAllSourcesIngestion` — without ever
 * going through node-cron's own timer. This is the primary, tested
 * overlap-prevention mechanism: a simple in-flight flag checked before
 * doing any work, so a tick that fires while a previous run is still in
 * progress is skipped outright, never queued or run concurrently. It
 * lives entirely here, at the scheduler/orchestration boundary — the
 * Phase 1G persistence layer is completely unaware this guard exists.
 * (node-cron's own `noOverlap` option is also enabled below as a second,
 * library-level backstop for genuine scheduled ticks — see
 * PHASE_1H2_REPORT.md §5 for why this flag is the primary mechanism.)
 */
export async function runScheduledIngestion(deps = {}) {
  const run = deps.runAllSourcesIngestion || runAllSourcesIngestion;

  if (isRunning) {
    console.log("[ingestion-scheduler] tick skipped — previous ingestion run is still in progress.");
    return { skipped: true, reason: "previous_run_in_progress" };
  }

  isRunning = true;
  const startedAt = new Date();
  console.log(`[ingestion-scheduler] run started at ${startedAt.toISOString()}`);

  try {
    // runAllSourcesIngestion (Phase 1H-1) is documented to never throw —
    // every failure mode (a failed source, an unexpected adapter/persist
    // error) is already captured inside its returned result. This
    // try/catch is a last-resort guard only, so one truly unexpected
    // error can never leave `isRunning` stuck true and permanently
    // disable future ticks.
    const result = await run();
    logRunSummary(result);
    return result;
  } catch (err) {
    console.error(`[ingestion-scheduler] unexpected error during scheduled run: ${err.message}`);
    return { error: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the recurring ingestion schedule. Idempotent: if a scheduler
 * instance is already active, this returns the existing task rather than
 * creating a second one — this is what prevents accidentally starting
 * multiple scheduler instances.
 *
 * @param {object} [options]
 * @param {string} [options.schedule] - overrides INGESTION_CRON_SCHEDULE/the default; mainly for tests.
 * @param {object} [deps] - injection seam for deterministic tests only
 *   (deps.runAllSourcesIngestion). Production callers should omit this
 *   entirely, which is exactly how backend/index.js calls it.
 * @returns the active cron task (node-cron's ScheduledTask).
 */
export function startIngestionScheduler(options = {}, deps = {}) {
  if (activeTask) {
    console.log("[ingestion-scheduler] start requested, but a scheduler instance is already active — ignoring.");
    return activeTask;
  }

  const schedule = resolveSchedule(options.schedule);

  const task = cron.schedule(schedule, () => runScheduledIngestion(deps), {
    name: TASK_NAME,
    noOverlap: true,
  });

  activeTask = task;
  console.log(`[ingestion-scheduler] started (schedule="${schedule}").`);
  return task;
}

/**
 * Stops and permanently tears down the active scheduler instance, if
 * any. Safe to call multiple times (a no-op if nothing is active).
 * Destroying the underlying node-cron task releases its internal timer
 * so the Node process can exit cleanly — verified in PHASE_1H2_REPORT.md §7.
 */
export function stopIngestionScheduler() {
  if (!activeTask) return;
  activeTask.destroy();
  activeTask = null;
  console.log("[ingestion-scheduler] stopped.");
}

// Exposed for tests/introspection only — not used by production startup.
export function getActiveTask() {
  return activeTask;
}

export { resolveSchedule, DEFAULT_CRON_SCHEDULE, TASK_NAME };
