import { classifyTechRelevance } from "./techRelevanceClassifier.js";
import { classifyExperienceLevel } from "./experienceClassifier.js";
import { deriveNormalizedSkills } from "./skillsExtractor.js";
import { classifyLanguage } from "./languageClassifier.js";

/** Adds classification fields to job */
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
