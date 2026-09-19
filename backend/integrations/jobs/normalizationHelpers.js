// Helpers shared by both normalizers

export function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Parses date, null if invalid
export function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// Epoch fallback for missing date
export function epochSecondsToDateOrNull(value) {
  if (typeof value !== "number" || !isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return isNaN(date.getTime()) ? null : date;
}

// Zero salary means not provided
export function salaryValueOrNull(value) {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !isFinite(num) || num === 0) return null;
  return num;
}

// Detects explicit remote mention
export function looksRemoteFromText(text) {
  if (typeof text !== "string") return false;
  return /\bremote\b/i.test(text);
}

// Decodes HTML entities in text
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

// Windows-1252 C1 character overrides
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

// Cheap mojibake pre-filter
const MOJIBAKE_HINT_PATTERN = /[Â-ßà-ï]/;

// Reverses misread bytes to UTF-8
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

// Repairs mojibake conservatively
export function repairMojibake(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  if (!MOJIBAKE_HINT_PATTERN.test(value)) return value;
  const repaired = tryReconstructFromMisreadBytes(value);
  return repaired && repaired !== value ? repaired : value;
}

// Denylist for placeholder/garbled titles
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
  // Scraped CTA text, not title
  "don't see your role? apply here",
  "don’t see your role? apply here",
]);

// Site chrome, truncated titles
const GARBLED_TITLE_PATTERNS = [/\bfind a job\b/i, /\b\d+(st|nd|rd|th)\s+[a-z]{2,5}$/i];

// Detects stacked CTA phrases
const CTA_SPAM_PRIMARY_PATTERN = /apply\s*now/i;
const CTA_SPAM_SECONDARY_PATTERNS = [/don'?t\s*close/i, /send.*resume/i];

function isCtaSpamTitle(title) {
  if (!CTA_SPAM_PRIMARY_PATTERN.test(title)) return false;
  return CTA_SPAM_SECONDARY_PATTERNS.some((pattern) => pattern.test(title));
}

// Titles never address the reader
const SECOND_PERSON_ADDRESS_PATTERN = /\b(you|your|yourself)\b/i;

// Common English stopwords
const COMMON_ENGLISH_STOPWORDS = new Set([
  "the", "and", "for", "with", "a", "an", "of", "to", "in", "on", "at",
  "is", "are", "we", "you", "our", "your", "as", "or", "by",
]);

// Heuristic for non-Latin titles
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
