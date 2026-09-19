import { upsertClassifiedJob } from "./jobService.js";

/** Persists classified jobs sequentially */
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
