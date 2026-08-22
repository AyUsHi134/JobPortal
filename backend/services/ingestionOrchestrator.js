import { fetchAdzunaJobs } from "../integrations/jobs/adzunaAdapter.js";
import { fetchRemoteOKJobs } from "../integrations/jobs/remoteOkAdapter.js";
import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";
import { normalizeRemoteOKJob } from "../integrations/jobs/remoteOkNormalizer.js";
import { normalizeBatch } from "../integrations/jobs/normalizeResult.js";
import { classifyJob } from "../integrations/jobs/classifyJob.js";
import { persistJobs } from "./jobIngestionPipeline.js";
import { withRetry } from "./ingestionReliability.js";

/**
 * Phase 1H-1 ingestion orchestrator.
 *
 * Composes the already-built, already-verified pipeline stages —
 * adapter (Phase 1D) -> normalizer (Phase 1E) -> classifier (Phase 1F) ->
 * persistence (Phase 1G) — into one reusable run. This file contains NO
 * source-specific HTTP handling, NO field mapping, NO classification
 * rules, and NO MongoDB/dedup logic of its own: every one of those
 * concerns is delegated to the existing module that already owns it.
 * This file only sequences calls and shapes a run summary.
 *
 * Uses whatever MongoDB connection Mongoose already has open (via the
 * Job model, transitively through persistJobs -> upsertClassifiedJob).
 * It never imports `mongoose` directly and never calls `.connect()`.
 */

// Maps each approved source name to its Phase 1D adapter (raw fetch) and
// Phase 1E normalizer (raw -> normalized shape). Adding a future approved
// source is exactly one new entry here — the orchestration logic below
// never changes per-source.
//
// Phase 1H-3: each fetch function is wrapped with withRetry() (see
// ingestionReliability.js) — a small, bounded retry for transient
// network/server failures only (never for auth/credential/malformed-
// response errors, which a retry cannot fix). This is the only change
// this phase makes to this file: the wrapping happens once, here, at
// registry construction — runSourceIngestion/runAllSourcesIngestion
// below are completely unchanged and have no idea retries exist.
const DEFAULT_SOURCE_REGISTRY = {
  adzuna: { fetch: withRetry(fetchAdzunaJobs), normalize: normalizeAdzunaJob },
  remoteok: { fetch: withRetry(fetchRemoteOKJobs), normalize: normalizeRemoteOKJob },
};

export const APPROVED_SOURCES = Object.keys(DEFAULT_SOURCE_REGISTRY);

// Never returns the raw job object itself: a rejected raw job can carry
// an arbitrarily large description or other source content, and — while
// none of it is credential-shaped (Phase 1D/1E adapters/normalizers never
// touch secrets) — a run summary should stay small and not become a
// dumping ground for arbitrary upstream payloads. Only a short, safely-
// typed identifying snippet is kept.
function summarizeRejectedNormalization(failed) {
  return failed.map((f) => {
    const raw = f.raw || {};
    const rawId = raw.id ?? raw.slug;
    return {
      reason: (f.error && f.error.reason) || "Unknown normalization failure.",
      source_id: rawId != null ? String(rawId) : null,
      title: typeof raw.title === "string" ? raw.title : typeof raw.position === "string" ? raw.position : null,
    };
  });
}

/**
 * Runs the complete ingestion pipeline for exactly one source.
 *
 * @param {string} sourceName - one of APPROVED_SOURCES
 * @param {object} [options] - passed straight through to that source's adapter
 * @param {object} [deps] - injection seam for deterministic tests only;
 *   production callers should omit this entirely.
 *   - deps.registry: overrides DEFAULT_SOURCE_REGISTRY (e.g. to stub `fetch`
 *     with a canned/mocked result while still using the real normalizer)
 *   - deps.persist: overrides persistJobs (e.g. to assert on how the
 *     orchestrator calls it, without requiring a live MongoDB connection)
 * @returns {Promise<object>} a structured, single-source run result — this
 *   function never throws; every failure mode is captured in the returned
 *   object so one source's total failure can never take down a caller
 *   that's also processing other sources.
 */
export async function runSourceIngestion(sourceName, options = {}, deps = {}) {
  const registry = deps.registry || DEFAULT_SOURCE_REGISTRY;
  const persist = deps.persist || persistJobs;
  const startedAt = new Date();

  const result = {
    source: sourceName,
    startedAt,
    finishedAt: null,
    durationMs: null,
    fetchOk: false,
    fetchedCount: 0,
    normalizedCount: 0,
    rejectedCount: 0,
    classifiedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedInvalidCount: 0,
    duplicateWarningCount: 0,
    failedCount: 0,
    meta: null,
    errors: [],
    warnings: [],
  };

  const finish = () => {
    result.finishedAt = new Date();
    result.durationMs = result.finishedAt - startedAt;
    return result;
  };

  const adapterEntry = registry[sourceName];
  if (!adapterEntry) {
    result.errors.push({ stage: "config", message: `"${sourceName}" is not an approved ingestion source.` });
    return finish();
  }

  // Adapters (Phase 1D) are designed to never throw — failures come back
  // as { ok: false, error }. This try/catch is a last-resort guard only,
  // so a genuinely unexpected error still can't end the whole run.
  let fetchResult;
  try {
    fetchResult = await adapterEntry.fetch(options);
  } catch (err) {
    result.errors.push({ stage: "fetch", message: err.message });
    return finish();
  }

  result.fetchOk = Boolean(fetchResult && fetchResult.ok);
  result.meta = (fetchResult && fetchResult.meta) || null;

  if (!result.fetchOk) {
    const error = (fetchResult && fetchResult.error) || { type: "unknown_error", message: "Adapter reported failure with no error detail." };
    result.errors.push({ stage: "fetch", ...error });
    return finish();
  }

  const rawJobs = Array.isArray(fetchResult.jobs) ? fetchResult.jobs : [];
  result.fetchedCount = rawJobs.length;

  // normalizeBatch (Phase 1E) already isolates one malformed raw job from
  // the rest — reused as-is, not reimplemented here.
  const { normalized, failed } = normalizeBatch(rawJobs, adapterEntry.normalize);
  result.normalizedCount = normalized.length;
  result.rejectedCount = failed.length;
  if (failed.length > 0) {
    result.warnings.push({
      stage: "normalize",
      message: `${failed.length} raw job(s) rejected during normalization.`,
      rejected: summarizeRejectedNormalization(failed),
    });
  }

  // classifyJob (Phase 1F) is pure and never throws on a well-formed
  // normalized job (verified in PHASE_1F_REPORT.md); it cannot itself
  // reject a job, so classifiedCount always equals normalizedCount.
  const classifiedJobs = normalized.map(classifyJob);
  result.classifiedCount = classifiedJobs.length;

  // persistJobs (Phase 1G) already isolates one bad job's DB/validation
  // error from the rest of the batch and never throws for the batch as a
  // whole under normal operation. This try/catch only guards against a
  // genuinely unexpected failure (e.g. no DB connection at all).
  let persistResult;
  try {
    persistResult = await persist(classifiedJobs);
  } catch (err) {
    result.errors.push({ stage: "persist", message: err.message });
    return finish();
  }

  const summary = persistResult.summary || {};
  result.insertedCount = summary.inserted || 0;
  result.updatedCount = summary.updated || 0;
  result.skippedInvalidCount = summary.skipped_invalid || 0;
  result.duplicateWarningCount = summary.cross_source_duplicate_warnings || 0;

  for (const r of persistResult.results || []) {
    if (r.status === "error") {
      result.errors.push({ stage: "persist", source_id: r.source_id, message: r.reason });
    }
  }

  result.failedCount = result.rejectedCount + result.skippedInvalidCount + (summary.errors || 0);

  return finish();
}

/**
 * Runs the complete ingestion pipeline for every approved source,
 * sequentially. A total failure in one source (adapter down, DB error,
 * etc.) is captured in that source's own result and does NOT prevent the
 * next source from being attempted — every source is always attempted
 * exactly once per call.
 *
 * @param {object} [optionsBySource] - e.g. { adzuna: { what: "developer" } }
 * @param {object} [deps] - same injection seam as runSourceIngestion; see
 *   there for details. Omit in production.
 * @returns {Promise<object>} { startedAt, finishedAt, durationMs, sources: [...], totals: {...} }
 */
export async function runAllSourcesIngestion(optionsBySource = {}, deps = {}) {
  const registry = deps.registry || DEFAULT_SOURCE_REGISTRY;
  const startedAt = new Date();

  const sources = [];
  for (const sourceName of Object.keys(registry)) {
    const sourceOptions = optionsBySource[sourceName] || {};
    // No try/catch needed here: runSourceIngestion never throws (every
    // failure mode is captured in its returned result object), which is
    // exactly what makes this loop safe to keep going after one source
    // fails completely.
    sources.push(await runSourceIngestion(sourceName, sourceOptions, deps));
  }

  const finishedAt = new Date();

  const totals = sources.reduce(
    (acc, s) => {
      acc.fetchedCount += s.fetchedCount;
      acc.normalizedCount += s.normalizedCount;
      acc.rejectedCount += s.rejectedCount;
      acc.classifiedCount += s.classifiedCount;
      acc.insertedCount += s.insertedCount;
      acc.updatedCount += s.updatedCount;
      acc.skippedInvalidCount += s.skippedInvalidCount;
      acc.duplicateWarningCount += s.duplicateWarningCount;
      acc.failedCount += s.failedCount;
      if (!s.fetchOk) acc.sourcesFailed += 1;
      return acc;
    },
    {
      fetchedCount: 0,
      normalizedCount: 0,
      rejectedCount: 0,
      classifiedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedInvalidCount: 0,
      duplicateWarningCount: 0,
      failedCount: 0,
      sourcesFailed: 0,
    }
  );

  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    sources,
    totals,
  };
}
