import { upsertClassifiedJob } from "./jobService.js";

/**
 * Persists a batch of already-normalized-and-classified Job objects
 * (the output of backend/integrations/jobs/classifyJob.js) through
 * jobService.upsertClassifiedJob, one at a time, in a single sequential
 * pass so the {source, source_id} partial unique index behaves
 * predictably (no concurrent upserts racing each other).
 *
 * Every individual job is wrapped in its own try/catch: one malformed
 * job or one failed upsert is recorded as an "error" outcome and does
 * NOT stop the rest of the batch from being processed. Errors are never
 * swallowed — each one is reported with its message.
 *
 * This function contains no source-specific parsing and never calls an
 * external API — it only persists what it is given.
 */
export async function persistJobs(jobs) {
  const results = [];

  for (const job of jobs || []) {
    try {
      const outcome = await upsertClassifiedJob(job);
      results.push(outcome);
    } catch (err) {
      results.push({
        status: "error",
        source: (job && job.source) || null,
        source_id: (job && job.source_id) || null,
        jobId: null,
        dedupFingerprint: null,
        crossSourceDuplicates: [],
        reason: err.message,
      });
    }
  }

  const summary = {
    total: results.length,
    inserted: results.filter((r) => r.status === "inserted").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped_invalid: results.filter((r) => r.status === "skipped_invalid").length,
    errors: results.filter((r) => r.status === "error").length,
    cross_source_duplicate_warnings: results.filter(
      (r) => Array.isArray(r.crossSourceDuplicates) && r.crossSourceDuplicates.length > 0
    ).length,
  };

  return { summary, results };
}
