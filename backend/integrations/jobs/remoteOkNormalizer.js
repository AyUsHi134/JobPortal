import { ok, fail } from "./normalizeResult.js";
import {
  nonEmptyString,
  toDateOrNull,
  epochSecondsToDateOrNull,
  salaryValueOrNull,
  decodeHtmlEntities,
  repairMojibake,
  isPlaceholderOrGarbledTitle,
} from "./normalizationHelpers.js";

/** Normalizes one raw RemoteOK job */
export function normalizeRemoteOKJob(rawJob) {
  if (!rawJob || typeof rawJob !== "object") {
    return fail("Raw RemoteOK job is missing or not an object.", rawJob);
  }

  const title = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.position)));
  const company = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.company)));
  const description = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.description)));
  // Prefer numeric id, else slug
  const sourceId =
    nonEmptyString(rawJob.id != null ? String(rawJob.id) : null) ||
    nonEmptyString(rawJob.slug);
  const locationRaw = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.location)));

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

  if (isPlaceholderOrGarbledTitle(title)) {
    return fail(`RemoteOK raw job title rejected as placeholder/garbled: "${title}".`, rawJob);
  }

  const tags = Array.isArray(rawJob.tags) ? rawJob.tags.filter((t) => typeof t === "string") : [];

  const job = {
    title,
    company,
    description,
    apply_link: nonEmptyString(rawJob.apply_url),

    location: {
      raw: locationRaw,
      // No structured location available
      display_name: locationRaw,
      city: null,
      state: null,
      country: null,
    },

    tags, // Raw tags only
    normalized_skills: [], // Derived later

    salary: {
      min: salaryValueOrNull(rawJob.salary_min),
      max: salaryValueOrNull(rawJob.salary_max),
      currency: null, // not reliably provided by RemoteOK
      is_estimated: null, // No salary_is_predicted equivalent
    },

    // Never derived from tags
    job_type: "unknown",

    // Always remote for RemoteOK
    is_remote: true,

    experience_level: "unknown", // Phase 1F
    is_tech_relevant: null, // Phase 1F
    tech_relevance_source: "unclassified", // Phase 1F
    source_category: null, // No category equivalent

    logo: nonEmptyString(rawJob.logo) || nonEmptyString(rawJob.company_logo) || "",

    source: "remoteok",
    source_id: sourceId,
  };

  // Omit unparseable date, never null
  const datePosted = toDateOrNull(rawJob.date) || epochSecondsToDateOrNull(rawJob.epoch);
  if (datePosted) job.date_posted = datePosted;

  return ok(job);
}
