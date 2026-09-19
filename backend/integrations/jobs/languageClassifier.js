import { safeLower } from "./classificationHelpers.js";

// Common Portuguese/Spanish function words
const NON_ENGLISH_LATIN_WORDS = [
  "de", "para", "com", "carros", "empresa", "vagas", "trabajo", "empleo",
  "con", "los", "las", "del", "una", "que",
];

function countDistinctWordMatches(text) {
  if (!text) return 0;
  let count = 0;
  for (const word of NON_ENGLISH_LATIN_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(text)) count++;
  }
  return count;
}

/** Tags language as en/other */
export function classifyLanguage(job) {
  const titleLower = safeLower(job && job.title);
  const descLower = safeLower(job && job.description);
  const combined = `${titleLower} ${descLower}`.trim();

  if (!combined) return "en";

  return countDistinctWordMatches(combined) >= 2 ? "other" : "en";
}
