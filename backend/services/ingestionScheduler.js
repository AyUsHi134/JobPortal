import cron from "node-cron";
import { runAllSourcesIngestion } from "./ingestionOrchestrator.js";

/** Recurring ingestion cron scheduler */

// Every 6 hours, within quota
const DEFAULT_CRON_SCHEDULE = "0 */6 * * *";
const TASK_NAME = "job-ingestion-scheduler";

let activeTask = null;
let isRunning = false;

// Invalid cron uses default
function resolveSchedule(explicitSchedule) {
  const candidate = explicitSchedule || process.env.INGESTION_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;
  if (cron.validate(candidate)) return candidate;
  console.error(
    `[ingestion-scheduler] "${candidate}" is not a valid cron expression — falling back to the default schedule "${DEFAULT_CRON_SCHEDULE}".`
  );
  return DEFAULT_CRON_SCHEDULE;
}

// Logs only counts and names
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

/** Per-tick work with overlap guard */
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
    // Last-resort guard for isRunning
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
 * Starts schedule, idempotent
 * @param {object} [options]
 * @param {string} [options.schedule] Override cron schedule
 * @param {object} [deps] Test injection only
 * @returns Active cron task
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

/** Stops and destroys scheduler */
export function stopIngestionScheduler() {
  if (!activeTask) return;
  activeTask.destroy();
  activeTask = null;
  console.log("[ingestion-scheduler] stopped.");
}

// Exposed for tests only
export function getActiveTask() {
  return activeTask;
}

export { resolveSchedule, DEFAULT_CRON_SCHEDULE, TASK_NAME };
