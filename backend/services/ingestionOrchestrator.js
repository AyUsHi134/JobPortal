import { fetchAdzunaJobs } from "../integrations/jobs/adzunaAdapter.js";
import { fetchRemoteOKJobs } from "../integrations/jobs/remoteOkAdapter.js";
import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";
import { normalizeRemoteOKJob } from "../integrations/jobs/remoteOkNormalizer.js";
import { normalizeBatch } from "../integrations/jobs/normalizeResult.js";
import { classifyJob } from "../integrations/jobs/classifyJob.js";
import { persistJobs } from "./jobIngestionPipeline.js";
import { withRetry } from "./ingestionReliability.js";

/** Ingestion orchestrator, sequences pipeline */

// Source registry with retry wrapping
const DEFAULT_SOURCE_REGISTRY = {
  adzuna: { fetch: withRetry(fetchAdzunaJobs), normalize: normalizeAdzunaJob },
  remoteok: { fetch: withRetry(fetchRemoteOKJobs), normalize: normalizeRemoteOKJob },
};

export const APPROVED_SOURCES = Object.keys(DEFAULT_SOURCE_REGISTRY);

// Never returns raw job
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
 * Runs pipeline for one source
 * @param {string} sourceName Approved source
 * @param {object} [options] Passed to adapter
 * @param {object} [deps] Test injection only
 * @returns {Promise<object>} Single-source run result
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

  // Last-resort guard
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

  // Batch isolates malformed jobs
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

  // Classification never rejects jobs
  const classifiedJobs = normalized.map(classifyJob);
  result.classifiedCount = classifiedJobs.length;

  // Guards unexpected persistence failure
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
 * Runs pipeline for all sources
 * @param {object} [optionsBySource] Per-source options
 * @param {object} [deps] Test injection only
 * @returns {Promise<object>} Run summary and totals
 */
export async function runAllSourcesIngestion(optionsBySource = {}, deps = {}) {
  const registry = deps.registry || DEFAULT_SOURCE_REGISTRY;
  const startedAt = new Date();

  const sources = [];
  for (const sourceName of Object.keys(registry)) {
    const sourceOptions = optionsBySource[sourceName] || {};
    // Loop safe; runs never throw
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
