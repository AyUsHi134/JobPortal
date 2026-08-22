import { safeLower, escapeRegExp } from "./classificationHelpers.js";
import { TECH_SKILL_NAMES } from "./techKeywords.js";

/**
 * Derives `normalized_skills` from an already-normalized Job object,
 * using only an exact-match curated allowlist (TECH_SKILL_NAMES) — never
 * arbitrary description/tag words. Checks both `description` text (any
 * source) and raw `tags` (RemoteOK) for a case-insensitive, word-boundary
 * match against each known technology name, then returns a deduplicated,
 * sorted, lowercase array. A skill absent from the allowlist is never
 * added, regardless of how often it appears.
 */
export function deriveNormalizedSkills(job) {
  const found = new Set();
  const descLower = safeLower(job && job.description);
  const tagsLower = Array.isArray(job && job.tags) ? job.tags.map(safeLower) : [];

  for (const skill of TECH_SKILL_NAMES) {
    const pattern = new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i");
    if (descLower && pattern.test(descLower)) {
      found.add(skill);
      continue;
    }
    if (tagsLower.some((t) => pattern.test(t))) {
      found.add(skill);
    }
  }

  return Array.from(found).sort();
}
