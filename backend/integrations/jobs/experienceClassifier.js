import { safeLower, matchesAny, extractYearsRange } from "./classificationHelpers.js";
import * as K from "./experienceKeywords.js";

// Maps year ranges to tiers
function tierFromYearsRange(range) {
  if (!range) return null;
  const { min, max } = range;
  if (min === 0 && (max === 1 || max === 2)) return "fresher";
  if ((min === 2 && max === 4) || (min === 3 && max === 5)) return "mid";
  if (min >= 5) return "senior";
  return null;
}

// Precedence: senior highest, entry lowest
function detectSignal(text, senior, junior, fresher) {
  if (matchesAny(text, senior)) return "senior";

  const yearsTier = tierFromYearsRange(extractYearsRange(text));
  if (yearsTier === "senior") return "senior";
  if (yearsTier === "mid") return "mid";

  if (matchesAny(text, junior)) return "junior";

  if (yearsTier === "fresher") return "fresher";
  if (matchesAny(text, fresher)) return "fresher";
  if (matchesAny(text, K.ENTRY_PATTERNS)) return "entry";

  return null;
}

/** Classifies experience level deterministically */
export function classifyExperienceLevel(job) {
  const titleLower = safeLower(job && job.title);
  const descLower = safeLower(job && job.description);

  const titleSignal = detectSignal(
    titleLower,
    K.TITLE_SENIOR_PATTERNS,
    K.TITLE_JUNIOR_PATTERNS,
    K.TITLE_FRESHER_PATTERNS
  );
  if (titleSignal) return titleSignal;

  const descSignal = detectSignal(
    descLower,
    K.DESCRIPTION_SENIOR_PATTERNS,
    K.DESCRIPTION_JUNIOR_PATTERNS,
    K.DESCRIPTION_FRESHER_PATTERNS
  );
  if (descSignal) return descSignal;

  return "unknown";
}
