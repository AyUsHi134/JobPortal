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

/** Classifies technology relevance deterministically */
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
