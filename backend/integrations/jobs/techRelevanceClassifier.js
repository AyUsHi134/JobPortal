import { safeLower, matchesAny, escapeRegExp } from "./classificationHelpers.js";
import {
  NON_TECH_TITLE_PATTERNS,
  TECH_QUALIFIER_PATTERNS,
  TECH_TITLE_PATTERNS,
  TECH_SKILL_NAMES,
} from "./techKeywords.js";

function countDistinctSkillMatches(text) {
  if (!text) return 0;
  let count = 0;
  for (const skill of TECH_SKILL_NAMES) {
    const pattern = new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i");
    if (pattern.test(text)) count++;
  }
  return count;
}

/**
 * Deterministic, explainable technology-relevance classification for an
 * already-normalized Job object. Returns exactly the two schema-approved
 * fields — { is_tech_relevant, tech_relevance_source } — never a
 * confidence score (JOB_SCHEMA_DESIGN.md deliberately rejected one).
 *
 * Precedence (first match wins):
 *   1. Hard non-tech title exclusion (overrides everything, including
 *      source_category) unless a tech qualifier word is also present.
 *   2. Adzuna's own `source_category === "IT Jobs"` — the strongest
 *      verified signal (ADZUNA_LIVE_TEST.md: 113/120 sampled jobs across
 *      six tech search terms were correctly categorized "IT Jobs").
 *   3. Title match against a curated technical-role pattern list.
 *   4. Description supporting evidence — requires 2+ distinct NAMED
 *      technologies (never a single generic word).
 *   5. Tags as a final tie-break only — same 2+-distinct bar, never
 *      authoritative alone (Phase 1A found tag-only matching produces
 *      false positives).
 *   6. No positive signal found -> false (we looked; found nothing).
 *
 * `is_tech_relevant` is only ever `null` when there is no title AND no
 * description to search at all (nothing to classify).
 */
export function classifyTechRelevance(job) {
  const titleLower = safeLower(job && job.title);
  const descLower = safeLower(job && job.description);

  if (!titleLower && !descLower) {
    return { is_tech_relevant: null, tech_relevance_source: "unclassified" };
  }

  if (
    titleLower &&
    matchesAny(titleLower, NON_TECH_TITLE_PATTERNS) &&
    !matchesAny(titleLower, TECH_QUALIFIER_PATTERNS)
  ) {
    return { is_tech_relevant: false, tech_relevance_source: "keyword_heuristic" };
  }

  const sourceCategory =
    job && typeof job.source_category === "string" ? job.source_category.toLowerCase() : null;
  if (job && job.source === "adzuna" && sourceCategory === "it jobs") {
    return { is_tech_relevant: true, tech_relevance_source: "source_category" };
  }

  if (titleLower && matchesAny(titleLower, TECH_TITLE_PATTERNS)) {
    return { is_tech_relevant: true, tech_relevance_source: "keyword_heuristic" };
  }

  if (countDistinctSkillMatches(descLower) >= 2) {
    return { is_tech_relevant: true, tech_relevance_source: "keyword_heuristic" };
  }

  const tagsText = Array.isArray(job && job.tags) ? job.tags.join(" ") : "";
  if (countDistinctSkillMatches(safeLower(tagsText)) >= 2) {
    return { is_tech_relevant: true, tech_relevance_source: "keyword_heuristic" };
  }

  return { is_tech_relevant: false, tech_relevance_source: "keyword_heuristic" };
}
