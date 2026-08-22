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
