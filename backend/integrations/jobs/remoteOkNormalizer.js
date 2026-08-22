import { ok, fail } from "./normalizeResult.js";
import {
  nonEmptyString,
  toDateOrNull,
  epochSecondsToDateOrNull,
  salaryValueOrNull,
} from "./normalizationHelpers.js";

/**
 * Converts one raw RemoteOK job (as returned by fetchRemoteOKJobs — see
 * backend/integrations/jobs/remoteOkAdapter.js) into the normalized shape
 * approved in JOB_SCHEMA_DESIGN.md. Returns { ok:true, job } on success,
 * or { ok:false, error, raw } if the raw job is missing data essential
 * to producing a valid normalized record.
 *
 * RemoteOK's `tags` are preserved as raw pass-through data only — they
 * are explicitly NOT treated as a technology/skill classification here
 * (see JOB_API_DATA_REPORT.md §3/§8: naive tag matching produced
 * confirmed false positives). is_tech_relevant/experience_level are left
 * at their approved defaults; that judgment belongs to Phase 1F.
 */
export function normalizeRemoteOKJob(rawJob) {
  if (!rawJob || typeof rawJob !== "object") {
    return fail("Raw RemoteOK job is missing or not an object.", rawJob);
  }

  const title = nonEmptyString(rawJob.position);
  const company = nonEmptyString(rawJob.company);
  const description = nonEmptyString(rawJob.description);
  // Prefer the numeric id; fall back to slug (both confirmed stable per
  // JOB_API_DATA_REPORT.md §3 and JOB_SCHEMA_DESIGN.md §5).
  const sourceId =
    nonEmptyString(rawJob.id != null ? String(rawJob.id) : null) ||
    nonEmptyString(rawJob.slug);
  const locationRaw = nonEmptyString(rawJob.location);

  const missing = [];
  if (!title) missing.push("position");
  if (!company) missing.push("company");
  if (!description) missing.push("description");
  if (!sourceId) missing.push("id/slug");
  if (!locationRaw) missing.push("location");

  if (missing.length > 0) {
    return fail(
      `RemoteOK raw job is missing required field(s): ${missing.join(", ")}.`,
      rawJob
    );
  }

  const tags = Array.isArray(rawJob.tags) ? rawJob.tags.filter((t) => typeof t === "string") : [];

  const job = {
    title,
    company,
    description,
    apply_link: nonEmptyString(rawJob.apply_url),

    location: {
      raw: locationRaw,
      // RemoteOK gives no structured city/state/country — never guessed
      // from the freeform string (JOB_SCHEMA_DESIGN.md §5).
      display_name: locationRaw,
      city: null,
      state: null,
      country: null,
    },

    tags, // raw pass-through only — not a tech/skill classification
    normalized_skills: [], // derived in a later phase, not built here

    salary: {
      min: salaryValueOrNull(rawJob.salary_min),
      max: salaryValueOrNull(rawJob.salary_max),
      currency: null, // not reliably provided by RemoteOK
      is_estimated: null, // RemoteOK has no equivalent to Adzuna's salary_is_predicted
    },

    // RemoteOK has no dedicated field, and employment-type words loosely
    // embedded in `tags` are not reliable enough to promote to a real
    // value (JOB_SCHEMA_DESIGN.md §5) — never derived from tags.
    job_type: "unknown",

    // RemoteOK is a remote-only job board by definition — hardcoded true
    // for every RemoteOK-sourced job, per JOB_SCHEMA_DESIGN.md §5.
    is_remote: true,

    experience_level: "unknown", // Phase 1F
    is_tech_relevant: null, // Phase 1F
    tech_relevance_source: "unclassified", // Phase 1F
    source_category: null, // RemoteOK has no equivalent to Adzuna's category

    logo: nonEmptyString(rawJob.logo) || nonEmptyString(rawJob.company_logo) || "",

    source: "remoteok",
    source_id: sourceId,
  };

  // Same reasoning as the Adzuna normalizer: omitted (not null) when
  // unparseable, so the schema's own Date.now default can still apply
  // later without normalization having fabricated anything.
  const datePosted = toDateOrNull(rawJob.date) || epochSecondsToDateOrNull(rawJob.epoch);
  if (datePosted) job.date_posted = datePosted;

  return ok(job);
}
