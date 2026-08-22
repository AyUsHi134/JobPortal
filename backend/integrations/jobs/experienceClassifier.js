import { safeLower, matchesAny, extractYearsRange } from "./classificationHelpers.js";
import * as K from "./experienceKeywords.js";

// Maps an explicit numeric year range to a tier. Only the exact ranges
// PHASE_1F's instructions evidenced are mapped — an unlisted range (e.g.
// "1-3 years") deliberately resolves to no signal (null) rather than
// guessing which tier it belongs to.
function tierFromYearsRange(range) {
  if (!range) return null;
  const { min, max } = range;
  if (min === 0 && (max === 1 || max === 2)) return "fresher";
  if ((min === 2 && max === 4) || (min === 3 && max === 5)) return "mid";
  if (min >= 5) return "senior";
  return null;
}

// Precedence within a single text: senior > mid > junior > fresher >
// entry. This is what guarantees a title containing "Senior" can never
// resolve to "fresher" even if the same title also happened to contain
// fresher-tier language.
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

/**
 * Deterministic, explainable experience-level classification for an
 * already-normalized Job object. Returns one of the schema-approved
 * values: "fresher", "entry", "junior", "mid", "senior", "unknown".
 *
 * The TITLE is checked first, in full, and — if it yields any signal at
 * all — that signal is returned immediately without ever consulting the
 * description. Only when the title gives no signal is the (more
 * restrictive) description check consulted. This is what implements
 * PHASE_1F's explicit requirement that a "Senior" title must never be
 * downgraded by an incidental "graduate" mention in the description.
 *
 * Missing or ambiguous evidence always resolves to "unknown" — fresher
 * status is never inferred merely because experience information is
 * absent (deliberately conservative, per PHASE_1F's instructions).
 */
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
