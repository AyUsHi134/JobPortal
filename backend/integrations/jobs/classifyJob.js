import { classifyTechRelevance } from "./techRelevanceClassifier.js";
import { classifyExperienceLevel } from "./experienceClassifier.js";
import { deriveNormalizedSkills } from "./skillsExtractor.js";
import { classifyLanguage } from "./languageClassifier.js";

/**
 * Takes an already-normalized Job object (Phase 1E output) and returns a
 * NEW object with the approved classification fields
 * (is_tech_relevant, tech_relevance_source, experience_level,
 * normalized_skills, language) derived and added/overwritten. Every other
 * field is preserved exactly as given — this never rewrites or removes any
 * source/normalized data, only adds the derived classification layer on
 * top. Never touches MongoDB, jobService, or any persistence concern.
 */
export function classifyJob(normalizedJob) {
  const techResult = classifyTechRelevance(normalizedJob);
  const experienceLevel = classifyExperienceLevel(normalizedJob);
  const normalizedSkills = deriveNormalizedSkills(normalizedJob);
  const language = classifyLanguage(normalizedJob);

  return {
    ...normalizedJob,
    is_tech_relevant: techResult.is_tech_relevant,
    tech_relevance_source: techResult.tech_relevance_source,
    experience_level: experienceLevel,
    normalized_skills: normalizedSkills,
    language,
  };
}
