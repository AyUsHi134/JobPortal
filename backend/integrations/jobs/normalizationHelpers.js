// Genuinely shared helpers used by more than one source normalizer. Each
// one exists specifically because both Adzuna and RemoteOK raw data need
// the same defensive treatment — nothing here is source-specific.

export function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Parses an ISO-8601-ish date string (Adzuna's `created`, RemoteOK's
// `date`). Returns null rather than an Invalid Date if unparseable —
// never fabricates a date.
export function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// RemoteOK's `epoch` is unix seconds, used only as a fallback when `date`
// itself is missing/unparseable.
export function epochSecondsToDateOrNull(value) {
  if (typeof value !== "number" || !isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return isNaN(date.getTime()) ? null : date;
}

// Treats missing, non-numeric, and literal 0 as "not provided". Per
// JOB_SCHEMA_DESIGN.md and the live evidence in JOB_API_DATA_REPORT.md /
// ADZUNA_LIVE_TEST.md, neither source has ever been observed to mean a
// genuine $0 salary by sending 0 — both use it (or omit the field
// entirely) to mean "no data". A real salary is never represented as 0.
export function salaryValueOrNull(value) {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !isFinite(num) || num === 0) return null;
  return num;
}

// Simple, explicitly-scoped text signal used only to detect an explicit
// "remote" mention in a location string. Never used to assert `false` —
// the absence of this word does not reliably mean "confirmed on-site",
// only "no remote signal found" (see JOB_SCHEMA_DESIGN.md §3, is_remote row).
export function looksRemoteFromText(text) {
  if (typeof text !== "string") return false;
  return /\bremote\b/i.test(text);
}

// Both sources are confirmed (JOB_API_DATA_REPORT.md / ADZUNA_LIVE_TEST.md)
// to sometimes send title/company text with raw HTML entities instead of
// their literal characters. Mirrors the decode set the frontend already
// applies to `description` (src/utils/jobDisplay.js's
// sanitizeDescriptionText) so title/company get the same treatment, kept
// dependency-free on purpose. Passes non-strings through unchanged so it's
// always safe to call before nonEmptyString().
export function decodeHtmlEntities(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
}

// Windows-1252's C1-range (0x80-0x9F) printable overrides — the standard
// WHATWG windows-1252 mapping table (undefined slots omitted on purpose:
// a byte with no defined mapping can never have produced a matching
// Unicode character, so it can never appear as a candidate for reversal).
// This is the table that makes "â€™" reconstructable: the apostrophe's
// UTF-8 bytes (0xE2 0x80 0x99) were misread as single-byte characters
// using THIS table, not plain Latin-1 (which would've rendered byte 0x80
// as an unprintable control character, not "€").
const CP1252_C1_TO_CODEPOINT = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};
const CODEPOINT_TO_CP1252_C1 = new Map(
  Object.entries(CP1252_C1_TO_CODEPOINT).map(([byte, codepoint]) => [codepoint, Number(byte)])
);

// Cheap pre-filter, checked before attempting any reconstruction: every
// mojibake case this repairs (â€™, Ã´, Â£, å, ä, ...) is caused by a
// multi-byte UTF-8 lead byte being misread as one single-byte character —
// and every such lead byte, misread this way, renders as a character in
// one of these two ranges. Text with neither is certain not to be this
// specific kind of corruption, so it's returned untouched without ever
// running the byte-reconstruction attempt below.
const MOJIBAKE_HINT_PATTERN = /[Â-ßà-ï]/;

// Reverses "each character re-encoded as a single byte, then that byte
// sequence misread as one character" back to the original UTF-8 bytes and
// re-decodes them properly. Returns null (never a best-effort guess) if
// any character can't have come from a single byte at all (real
// multi-byte Unicode — CJK, emoji, etc. — makes this impossible) or if
// re-decoding the reconstructed bytes as UTF-8 hits an invalid sequence
// (Node's TextDecoder-backed Buffer#toString substitutes U+FFFD for any
// byte sequence that isn't valid UTF-8, which this treats as "not
// reconstructable" rather than accepting a partially-broken result).
function tryReconstructFromMisreadBytes(text) {
  const bytes = [];
  for (const ch of text) {
    const codepoint = ch.codePointAt(0);
    if (codepoint <= 0xff) {
      bytes.push(codepoint);
    } else if (CODEPOINT_TO_CP1252_C1.has(codepoint)) {
      bytes.push(CODEPOINT_TO_CP1252_C1.get(codepoint));
    } else {
      return null;
    }
  }
  const reconstructed = Buffer.from(bytes).toString("utf8");
  return reconstructed.includes("�") ? null : reconstructed;
}

// Repairs UTF-8 text that was previously decoded as if it were a
// single-byte encoding (Windows-1252/Latin-1) and re-encoded — the
// classic "mojibake" pattern seen live in source data: "Donâ€™t" for
// "Don't", "CÃ´te" for "Côte". This is a source-side data-quality defect
// (confirmed pre-existing this pipeline — see PHASE_1H4_REPORT.md §9),
// not something introduced by any code here; this function only repairs
// it wherever it's found.
//
// Deliberately conservative on both ends: the cheap hint-pattern check
// skips any text that couldn't possibly be this corruption, and
// tryReconstructFromMisreadBytes only ever returns a result that
// round-trips to clean, valid UTF-8 with zero replacement characters —
// legitimate accented text (a real "café", "château", "São Paulo") fails
// that clean-round-trip check and is returned completely unchanged,
// because reinterpreting its own already-correct bytes as a single-byte
// encoding does not produce another valid UTF-8 sequence. Passes
// non-strings through unchanged, exactly like decodeHtmlEntities, so it's
// always safe to call before nonEmptyString().
export function repairMojibake(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  if (!MOJIBAKE_HINT_PATTERN.test(value)) return value;
  const repaired = tryReconstructFromMisreadBytes(value);
  return repaired && repaired !== value ? repaired : value;
}

// Denylist-style detection for placeholder/test listings and known-garbled
// source titles. JOB_API_DATA_REPORT.md's "Data quality caveats" section
// documents a literal "Test Job" listing observed live on RemoteOK, and
// ADZUNA_LIVE_TEST.md notes "at least one spam-like title" among Adzuna's
// agency postings. Deliberately narrow and denylist/pattern-based rather
// than a broad "looks weird" heuristic: a false positive here silently
// drops a real job, which is worse than leaving one bad title in. Never
// used to edit/shorten a title — only to decide whether the whole record
// should be rejected (via the normalizer's existing fail() path).
const PLACEHOLDER_TITLE_EXACT = new Set([
  "test",
  "test job",
  "this is a test",
  "sample job",
  "sample listing",
  "placeholder",
  "placeholder job",
  "dummy job",
  "untitled",
  "n/a",
  "tbd",
  "now hiring",
  "sourcer private destinations",
  // Confirmed live scraped site-chrome CTA text, not a role name (an
  // "apply here" prompt shown on a source's listing page rather than an
  // actual job posting). Two apostrophe variants are listed because
  // filtering runs AFTER repairMojibake (see adzunaNormalizer.js/
  // remoteOkNormalizer.js) — a source that sent this with correctly
  // UTF-8-encoded text already uses the plain apostrophe, while a source
  // that sent it as mojibake ("Donâ€™t...") arrives here already repaired
  // to the curly one, so both are real, reachable inputs to this check,
  // not redundant entries. This is an exact whole-title match only — it
  // does not touch any title merely containing "apply" or "role"
  // elsewhere (e.g. "React Developer - Remote" or "Hiring Manager" are
  // untouched by this or any other entry here).
  "don't see your role? apply here",
  "don’t see your role? apply here",
]);

// "Find a job" is site navigation/marketing chrome text, not a role name —
// no legitimate job title contains it. This also covers titles truncated
// at a pagination boundary that leave a mid-word fragment right after an
// ordinal (e.g. "...3rd comi[ng soon]").
const GARBLED_TITLE_PATTERNS = [/\bfind a job\b/i, /\b\d+(st|nd|rd|th)\s+[a-z]{2,5}$/i];

// Generic call-to-action "spam construct" detection: a title that stacks
// TWO separate imperative CTA phrases (e.g. "Apply Now" combined with
// "Don't close this page" or "Send your resume") is scraped listing-page
// chrome bleeding into the title field, not a role name — a real job
// title never combines multiple imperative CTAs like this. Deliberately a
// co-occurrence check, not a single-pattern entry in GARBLED_TITLE_PATTERNS
// above: "Apply Now" alone is far too weak a signal to reject on its own
// (it could plausibly be part of a longer real title), but combined with a
// second, independent CTA phrase it stops being a plausible title at all.
const CTA_SPAM_PRIMARY_PATTERN = /apply\s*now/i;
const CTA_SPAM_SECONDARY_PATTERNS = [/don'?t\s*close/i, /send.*resume/i];

function isCtaSpamTitle(title) {
  if (!CTA_SPAM_PRIMARY_PATTERN.test(title)) return false;
  return CTA_SPAM_SECONDARY_PATTERNS.some((pattern) => pattern.test(title));
}

// General rule, not a per-phrase entry: a real job title is a noun phrase
// ("Senior Backend Engineer") and never addresses the reader directly
// ("Apply Now, You Won't Regret It!", "Grow Your Career With Us", "Don't
// See Your Role? Apply Here"). A standalone "you"/"your"/"yourself" is
// therefore, on its own, already a reliable signal that the field holds
// listing-page/CTA chrome rather than a role name — independently
// covering the CTA co-occurrence check and the "Don't see your role"
// entry above without relying on either of them.
const SECOND_PERSON_ADDRESS_PATTERN = /\b(you|your|yourself)\b/i;

// Curated, minimal set of very common English function words. Used only as
// a corroborating signal inside isLikelyNonEnglish below — never as the
// sole basis for a reject decision, since a completely normal, short
// technical title (e.g. "Senior React Developer") legitimately contains
// zero of these.
const COMMON_ENGLISH_STOPWORDS = new Set([
  "the", "and", "for", "with", "a", "an", "of", "to", "in", "on", "at",
  "is", "are", "we", "you", "our", "your", "as", "or", "by",
]);

// Cheap, dependency-free language heuristic for a title written in a
// non-Latin script (Chinese, Japanese, Korean, Arabic, Cyrillic,
// Devanagari, ...) slipping through as an otherwise "valid" record.
// Deliberately NOT a general English-vs-other-Latin-language detector —
// French/German/Spanish titles are not reliably distinguishable from
// English this way, and misfiring on those would silently drop a real
// job, the same risk this file's other title checks are already
// conservative about.
//
// Primary signal: the proportion of the title's letters that are plain
// ASCII (A-Z/a-z). A non-Latin-script title has a low ratio by
// construction; a genuine English title (even with an occasional accented
// character, e.g. in a company name) stays close to 1.0.
//   - ratio >= 0.7: clearly Latin-script — never flagged.
//   - ratio < 0.3: clearly non-Latin-script — flagged outright; no ASCII
//     stopword could ever appear in these scripts anyway.
//   - otherwise (mixed-script): flagged only if not even one common
//     English stopword appears as a whole word — the corroborating signal
//     that keeps this from misfiring on a short, stopword-free but
//     genuinely English/Latin-script title.
export function isLikelyNonEnglish(text) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  const letters = trimmed.match(/\p{L}/gu);
  if (!letters || letters.length === 0) return false;

  const asciiLetters = trimmed.match(/[A-Za-z]/g) || [];
  const asciiRatio = asciiLetters.length / letters.length;

  if (asciiRatio >= 0.7) return false;
  if (asciiRatio < 0.3) return true;

  const words = trimmed.toLowerCase().match(/[a-z']+/g) || [];
  return !words.some((w) => COMMON_ENGLISH_STOPWORDS.has(w));
}

export function isPlaceholderOrGarbledTitle(title) {
  if (typeof title !== "string") return false;
  const normalized = title.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (PLACEHOLDER_TITLE_EXACT.has(normalized)) return true;
  if (GARBLED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return true;
  if (isCtaSpamTitle(title)) return true;
  if (SECOND_PERSON_ADDRESS_PATTERN.test(title)) return true;
  return isLikelyNonEnglish(title);
}
