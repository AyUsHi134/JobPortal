import { ok, fail } from "./normalizeResult.js";
import {
  nonEmptyString,
  toDateOrNull,
  salaryValueOrNull,
  looksRemoteFromText,
  decodeHtmlEntities,
  repairMojibake,
  isPlaceholderOrGarbledTitle,
} from "./normalizationHelpers.js";

/** Normalizes one raw Adzuna job */
export function normalizeAdzunaJob(rawJob) {
  if (!rawJob || typeof rawJob !== "object") {
    return fail("Raw Adzuna job is missing or not an object.", rawJob);
  }

  const title = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.title)));
  const company = nonEmptyString(
    decodeHtmlEntities(repairMojibake(rawJob.company && rawJob.company.display_name))
  );
  const description = nonEmptyString(decodeHtmlEntities(repairMojibake(rawJob.description)));
  const sourceId = nonEmptyString(rawJob.id != null ? String(rawJob.id) : null);
  const locationDisplay = nonEmptyString(
    decodeHtmlEntities(repairMojibake(rawJob.location && rawJob.location.display_name))
  );

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

  if (isPlaceholderOrGarbledTitle(title)) {
    return fail(`Adzuna raw job title rejected as placeholder/garbled: "${title}".`, rawJob);
  }

  // India area: country, state, city
  const area = rawJob.location && Array.isArray(rawJob.location.area) ? rawJob.location.area : [];
  const country = nonEmptyString(decodeHtmlEntities(repairMojibake(area[0])));
  const state = nonEmptyString(decodeHtmlEntities(repairMojibake(area[1])));
  const city = nonEmptyString(decodeHtmlEntities(repairMojibake(area[2])));

  const salaryMin = salaryValueOrNull(rawJob.salary_min);
  const salaryMax = salaryValueOrNull(rawJob.salary_max);
  // Predicted flag needs salary
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

    tags: [], // No tags from Adzuna
    normalized_skills: [], // Derived later

    salary: {
      min: salaryMin,
      max: salaryMax,
      currency: null, // Not provided by Adzuna
      is_estimated: isEstimated,
    },

    // Pass observed value through
    job_type: nonEmptyString(rawJob.contract_time) || "unknown",

    // True only on explicit remote
    is_remote: looksRemoteFromText(locationDisplay) ? true : null,

    experience_level: "unknown", // Phase 1F
    is_tech_relevant: null, // Phase 1F
    tech_relevance_source: "unclassified", // Phase 1F
    source_category: nonEmptyString(rawJob.category && rawJob.category.label),

    logo: "", // not documented/observed for Adzuna

    source: "adzuna",
    source_id: sourceId,
  };

  // Omit unparseable date, never null
  const datePosted = toDateOrNull(rawJob.created);
  if (datePosted) job.date_posted = datePosted;

  return ok(job);
}
