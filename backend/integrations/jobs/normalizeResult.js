// Shared result convention for normalization, mirroring the adapter-level
// success()/failure() convention from adapterResult.js so the two layers
// feel consistent. Normalizers never throw for bad input — a malformed
// raw job produces a `fail()` result, not an exception, so a caller
// processing many raw jobs (via normalizeBatch below) never has one bad
// record crash the rest.

export function ok(job) {
  return { ok: true, job, error: null };
}

export function fail(reason, rawJob) {
  return { ok: false, job: null, error: { reason }, raw: rawJob };
}

// Runs normalizeFn over every raw job, separating successes from
// failures. A single malformed record is captured in `failed` and does
// not stop the rest of the batch from being processed.
export function normalizeBatch(rawJobs, normalizeFn) {
  const normalized = [];
  const failed = [];
  for (const rawJob of rawJobs || []) {
    const result = normalizeFn(rawJob);
    if (result.ok) normalized.push(result.job);
    else failed.push(result);
  }
  return { normalized, failed };
}
