import { safeLower } from "./classificationHelpers.js";

// Small, curated set of common Portuguese/Spanish function words —
// frequent in real Portuguese/Spanish text, and unlikely to appear as
// whole words in legitimate English technical copy. This complements
// isLikelyNonEnglish (normalizationHelpers.js), which only catches
// non-Latin scripts (Chinese, Arabic, Cyrillic, ...) — a Portuguese/
// Spanish title/description written in the Latin alphabet passes that
// ASCII-ratio check cleanly, so it needs its own signal.
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

/**
 * Deterministic, explainable Latin-script language tag for an
 * already-normalized Job object. Returns exactly "en" or "other" — never
 * a confidence score, and never anything else (mirrors
 * classifyTechRelevance's contract). This is a TAGGING step only: unlike
 * isPlaceholderOrGarbledTitle in normalizationHelpers.js, a result of
 * "other" here never rejects/fails a job during normalization — it only
 * sets the `language` field so it can later be filtered
 * (jobService.buildJobFilter's `language` option). Never throws.
 *
 * Requires 2+ DISTINCT common Portuguese/Spanish words as whole-word,
 * case-insensitive matches across title+description combined before
 * returning "other" — a single incidental match is too weak a signal
 * alone (the same "2+ distinct" bar classifyTechRelevance already uses
 * for its own description/tag evidence) and is deliberately not enough on
 * its own to avoid false positives against genuine English text.
 */
export function classifyLanguage(job) {
  const titleLower = safeLower(job && job.title);
  const descLower = safeLower(job && job.description);
  const combined = `${titleLower} ${descLower}`.trim();

  if (!combined) return "en";

  return countDistinctWordMatches(combined) >= 2 ? "other" : "en";
}
