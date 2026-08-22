import { ok, fail } from "./normalizeResult.js";
import {
  nonEmptyString,
  toDateOrNull,
  salaryValueOrNull,
  looksRemoteFromText,
} from "./normalizationHelpers.js";

/**
 * Converts one raw Adzuna job (as returned by fetchAdzunaJobs — see
 * backend/integrations/jobs/adzunaAdapter.js) into the normalized shape
 * approved in JOB_SCHEMA_DESIGN.md. Returns { ok:true, job } on success,
 * or { ok:false, error, raw } if the raw job is missing data essential
 * to producing a valid normalized record — it never throws and never
 * invents a value the source didn't actually provide.
 *
 * Does NOT set is_tech_relevant, experience_level beyond their approved
 * defaults (Phase 1F), does NOT compute dedup_fingerprint (deduplication
 * is out of scope here), and does NOT set last_seen_at/status/createdAt/
 * updatedAt — those are ingestion-lifecycle concerns owned by
 * jobService.upsertJobBySource, not by normalization.
 */
export function normalizeAdzunaJob(rawJob) {
  if (!rawJob || typeof rawJob !== "object") {
    return fail("Raw Adzuna job is missing or not an object.", rawJob);
  }

  const title = nonEmptyString(rawJob.title);
  const company = nonEmptyString(rawJob.company && rawJob.company.display_name);
  const description = nonEmptyString(rawJob.description);
  const sourceId = nonEmptyString(rawJob.id != null ? String(rawJob.id) : null);
  const locationDisplay = nonEmptyString(rawJob.location && rawJob.location.display_name);

  const missing = [];
  if (!title) missing.push("title");
  if (!company) missing.push("company.display_name");
  if (!description) missing.push("description");
  if (!sourceId) missing.push("id");
  if (!locationDisplay) missing.push("location.display_name");

  if (missing.length > 0) {
    return fail(
      `Adzuna raw job is missing required field(s): ${missing.join(", ")}.`,
      rawJob
    );
  }

  // Confirmed live (ADZUNA_LIVE_TEST.md §6) for India-scoped queries:
  // location.area is [country, state, city]. Not assumed for other
  // countries/queries — just defensively read positionally with a
  // fallback to null for any missing slot.
  const area = rawJob.location && Array.isArray(rawJob.location.area) ? rawJob.location.area : [];
  const country = nonEmptyString(area[0]);
  const state = nonEmptyString(area[1]);
  const city = nonEmptyString(area[2]);

  const salaryMin = salaryValueOrNull(rawJob.salary_min);
  const salaryMax = salaryValueOrNull(rawJob.salary_max);
  // salary_is_predicted only means something if a salary actually exists;
  // Adzuna sends it as the string "0"/"1" (confirmed live).
  const isEstimated =
    salaryMin == null && salaryMax == null
      ? null
      : rawJob.salary_is_predicted === "1" ||
        rawJob.salary_is_predicted === 1 ||
        rawJob.salary_is_predicted === true;

  const job = {
    title,
    company,
    description,
    apply_link: nonEmptyString(rawJob.redirect_url),

    location: {
      raw: locationDisplay,
      display_name: locationDisplay,
      city,
      state,
      country,
    },

    tags: [], // Adzuna provides no tags array (JOB_SCHEMA_DESIGN.md §4)
    normalized_skills: [], // derived in a later phase, not built here

    salary: {
      min: salaryMin,
      max: salaryMax,
      currency: null, // not reliably provided by Adzuna — JOB_SCHEMA_DESIGN.md §13.1
      is_estimated: isEstimated,
    },

    // Only the value actually observed live (JOB_API_DATA_REPORT... /
    // ADZUNA_LIVE_TEST.md: "full_time" on ~80% of sampled jobs) is passed
    // through as-is; anything else Adzuna sends is preserved verbatim
    // rather than forced into an invented taxonomy. Absent -> "unknown".
    job_type: nonEmptyString(rawJob.contract_time) || "unknown",

    // No dedicated remote field from Adzuna. true only on an explicit
    // "remote" mention in the location text; never false, since Adzuna
    // gives no reliable "confirmed on-site" signal at all.
    is_remote: looksRemoteFromText(locationDisplay) ? true : null,

    experience_level: "unknown", // Phase 1F
    is_tech_relevant: null, // Phase 1F
    tech_relevance_source: "unclassified", // Phase 1F
    source_category: nonEmptyString(rawJob.category && rawJob.category.label),

    logo: "", // not documented/observed for Adzuna

    source: "adzuna",
    source_id: sourceId,
  };

  // date_posted deliberately omitted (left undefined) rather than set to
  // null when unparseable: the schema's own `default: Date.now` only
  // applies when the key is absent, not when it's explicitly null. This
  // way normalization never fabricates a date, but also never blocks the
  // schema's already-approved fallback from working correctly later.
  const datePosted = toDateOrNull(rawJob.created);
  if (datePosted) job.date_posted = datePosted;

  return ok(job);
}
