// Shared normalization result convention

export function ok(job) {
  return { ok: true, job, error: null };
}

export function fail(reason, rawJob) {
  return { ok: false, job: null, error: { reason }, raw: rawJob };
}

// Normalizes batch, separates failures
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
