import { safeLower, escapeRegExp } from "./classificationHelpers.js";
import { TECH_SKILL_NAMES } from "./techKeywords.js";

/** Extracts skills from allowlist */
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
