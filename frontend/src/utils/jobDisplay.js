// Pure, framework-free formatting helpers for rendering a public Job
// object (BACKEND_API_CONTRACT.md §2) honestly — every function here
// returns `null` when the underlying data doesn't support a confident
// statement, rather than fabricating or guessing a value. Callers
// (JobCard.jsx now, JobDetail.jsx in a later phase) render `null` as
// "omit this piece of metadata," never as a placeholder like "Unknown"
// or a fake default. Kept dependency-free and side-effect-free so it can
// be unit-tested directly (see src/tests/testJobDisplay.js) without any
// React rendering.

/**
 * Cleans a single already-chosen location string (display_name or raw) so
 * a source-side artifact — a trailing comma from a missing trailing
 * field ("Hounslow,"), a leading comma, or an empty comma-separated
 * segment ("City, , Country") — never reaches the UI (Phase 2G-2, item
 * 5). Splitting on "," and rejoining only the non-empty, trimmed pieces
 * removes exactly these artifacts without altering any real content.
 * Returns `null` (never an empty string) when nothing usable remains, and
 * only ever operates on an actual string — a malformed field that came
 * through as an object/number is rejected here rather than stringified,
 * which is also what keeps a bad `location.raw`/`display_name` from ever
 * rendering as "[object Object]".
 */
function cleanLocationText(text) {
  if (typeof text !== "string") return null;
  const cleaned = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return cleaned || null;
}

/**
 * Location fallback order (documented, not incidental):
 *   1. `location.display_name` — the source-provided "best human-readable
 *      form" (JOB_SCHEMA_DESIGN.md §3). Only Adzuna populates this
 *      distinctly; treated as most trustworthy when present.
 *   2. A comma-joined combination of whatever structured `city`/`state`/
 *      `country` pieces ARE present (skipping any that are null, and any
 *      that aren't actually strings) — more granular than `raw` when
 *      `display_name` itself is missing but partial structured data
 *      exists.
 *   3. `location.raw` — guaranteed present by the schema (`required:
 *      true`), so this is the only step that can't itself return nothing.
 * Never fabricates a location string when the object is missing entirely,
 * and every string that reaches the UI is passed through
 * cleanLocationText() first so a stray trailing/leading/empty comma from
 * the source data never surfaces (see BACKEND_API_CONTRACT.md §2 — the
 * live dataset's RemoteOK-sourced `raw`/`display_name` values are exactly
 * where this artifact comes from).
 */
export function formatLocation(location) {
  if (!location || typeof location !== "object") return null;
  const displayName = cleanLocationText(location.display_name);
  if (displayName) return displayName;
  const parts = [location.city, location.state, location.country].filter(
    (part) => typeof part === "string" && part.trim()
  );
  if (parts.length > 0) return parts.map((part) => part.trim()).join(", ");
  return cleanLocationText(location.raw);
}

// A fixed "en-US" locale is used deliberately, not the runtime's default
// locale — `toLocaleString()` with no locale argument depends on
// whatever locale the environment (or, in a real browser, the visitor's
// own OS/browser settings) happens to have configured, which would make
// the same job's salary render with different digit grouping for
// different users (e.g. "800,000" vs "8,00,000") and made this exact
// function non-deterministic across test/deploy environments. A fixed
// locale keeps the figure consistent for every viewer.
function formatMoney(amount) {
  return typeof amount === "number" ? amount.toLocaleString("en-US") : String(amount);
}

/**
 * Salary formatting — handles every combination BACKEND_API_CONTRACT.md
 * §2/§9 documents: a missing salary object entirely, both min/max null
 * (the common case — 0 of 113 active jobs had a populated max as of
 * Phase 1I-2's live check), min-only, max-only, both, a currency code,
 * and the `is_estimated` flag. Returns `null` (never "$0"/"0"/any
 * fabricated figure) when there's nothing real to report — callers show
 * a neutral "Salary not provided" instead of this return value, or omit
 * the line entirely (JobCard.jsx omits it — see PHASE_2C_REPORT.md §2).
 */
export function formatSalary(salary) {
  if (!salary || typeof salary !== "object") return null;
  const { min, max, currency, is_estimated } = salary;
  if (min == null && max == null) return null;

  const prefix = currency ? `${currency} ` : "";
  let range;
  if (min != null && max != null) {
    range = `${prefix}${formatMoney(min)} – ${formatMoney(max)}`;
  } else if (min != null) {
    range = `${prefix}${formatMoney(min)}+`;
  } else {
    range = `Up to ${prefix}${formatMoney(max)}`;
  }
  return is_estimated ? `${range} (estimated)` : range;
}

const EXPERIENCE_LABELS = {
  fresher: "Fresher",
  entry: "Entry Level",
  junior: "Junior",
  mid: "Mid Level",
  senior: "Senior",
};

/**
 * Never returns a label for `"unknown"` (or anything unrecognized) — the
 * backend's own enum includes "unknown" as a real, valid, non-confirmed
 * value (BACKEND_API_CONTRACT.md §2), and treating it as a displayable
 * level would misrepresent unclassified data as a confirmed fact.
 * Callers omit the experience badge entirely when this returns `null`.
 */
export function formatExperience(level) {
  return EXPERIENCE_LABELS[level] || null;
}

// Phase 2G-7B: which semantic badge accent (2G-7A's $badge-yellow-*/
// $badge-lavender-* tokens) an experience level's badge should use —
// "entry" (fresher/entry) reads as a distinct, encouraging tone from
// "senior" (junior/mid/senior, grouped per this phase's own "Senior/
// other experience: soft lavender" direction). Mirrors formatExperience's
// own recognized-level set exactly, so a badge only ever gets a tone when
// it would actually render text (an unrecognized/"unknown" level, which
// formatExperience already omits, never gets a tone computed for it).
export function getExperienceBadgeTone(level) {
  if (!EXPERIENCE_LABELS[level]) return null;
  return level === "fresher" || level === "entry" ? "entry" : "senior";
}

/**
 * `is_remote` is tri-state (true/false/null) per BACKEND_API_CONTRACT.md
 * §2 — `null`/`undefined`/any other value all mean "unknown" and must
 * never be presented as "not remote" or, worse, "remote."
 */
export function formatRemote(isRemote) {
  if (isRemote === true) return "Remote";
  if (isRemote === false) return "On-site";
  return null;
}

/**
 * Badge-specific remote signal for the compact JobCard badge row (Phase
 * 2G-2). Deliberately narrower than formatRemote() above: that function
 * also surfaces a confirmed "On-site" label (used in JobDetail's meta
 * row, unchanged), but the JobCard badge area only ever asserts a
 * positive "Remote" signal — `false`, `null`, and `undefined` are all
 * silently omitted from the badge row, never rendered as a "not remote"
 * badge that doesn't exist in this design.
 */
export function formatRemoteBadge(isRemote) {
  return isRemote === true ? "Remote" : null;
}

/**
 * Only ever returns a positive "Tech" signal — `false` and `null` both
 * simply omit the badge (there's no confirmed-non-tech badge shown),
 * which avoids ever conflating "confirmed non-tech" with "unclassified"
 * in the UI, per this phase's explicit "do not silently convert unknown
 * to false" instruction — neither state is asserted, both are just quiet.
 */
export function formatTechRelevance(isTechRelevant) {
  return isTechRelevant === true ? "Tech" : null;
}

const SOURCE_LABELS = { adzuna: "Adzuna", remoteok: "RemoteOK" };

/** "manual" and any unrecognized source are omitted — not useful to surface to an end user. */
export function formatSource(source) {
  return SOURCE_LABELS[source] || null;
}

/**
 * A short, relative "posted X days ago" for recent postings, falling
 * back to a locale date string once it's no longer recent — deterministic
 * given a fixed `now` (defaults to the real current time; a caller/test
 * may pass one explicitly).
 */
export function formatDatePosted(datePosted, now = Date.now()) {
  if (!datePosted) return null;
  const posted = new Date(datePosted);
  if (Number.isNaN(posted.getTime())) return null;

  const diffDays = Math.floor((now - posted.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Posted today";
  if (diffDays === 1) return "Posted 1 day ago";
  if (diffDays < 30) return `Posted ${diffDays} days ago`;
  return `Posted ${posted.toLocaleDateString()}`;
}

/**
 * A confirmed-remote job whose formatted location string is itself just
 * "Remote" (case-insensitively) would duplicate the badge already shown
 * (Phase 2G-2, item 4) — this decides ONLY that exact contentless case.
 * A genuinely more specific location on a remote job (e.g. "Remote,
 * India", or a real city) is never suppressed — only a location string
 * that carries no information beyond what the Remote badge already says.
 */
export function isDuplicateRemoteLocation(isRemoteConfirmed, locationText) {
  if (!isRemoteConfirmed || !locationText) return false;
  return locationText.trim().toLowerCase() === "remote";
}

/** Only http(s) links are treated as valid — never fabricates or "fixes" a malformed/missing apply_link. */
export function isValidApplyLink(link) {
  return typeof link === "string" && /^https?:\/\//i.test(link.trim());
}

/**
 * Description rendering (Phase 2D). BACKEND_API_CONTRACT.md §2 documents
 * that `description` is passed through from the source verbatim and MAY
 * contain raw HTML — the backend does not sanitize it, and the frontend
 * "must never use dangerouslySetInnerHTML without a sanitizer." Rather
 * than pulling in a sanitizer dependency (DOMPurify etc. — an
 * "unnecessary dependency" this phase is explicitly told to avoid) for a
 * single field, this strips ALL markup down to plain text: block-level
 * tags become line breaks (so paragraph/list structure survives as
 * readable line breaks) and every remaining tag is discarded outright.
 * The result is rendered as plain text (JobDetail.jsx maps it into `<p>`
 * elements, never `dangerouslySetInnerHTML`), so no markup — safe or
 * unsafe — ever reaches the DOM as HTML. A plain-text description (no
 * markup at all) passes through this same path harmlessly, since there
 * are no tags to strip.
 */
export function sanitizeDescriptionText(description) {
  if (typeof description !== "string" || !description.trim()) return null;

  const withLineBreaks = description
    // Block-level boundaries become newlines so structure isn't lost.
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    // Every remaining tag (opening, closing, self-closing) is dropped —
    // its content is kept as plain text, never re-injected as markup.
    .replace(/<[^>]*>/g, "");

  return withLineBreaks
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
}

/**
 * Splits a (possibly HTML-bearing) description into readable paragraphs
 * for `<p>`-per-entry rendering. Returns `[]` (never fabricates filler
 * text) for a missing/empty/whitespace-only description — callers show
 * an honest "no description provided" message instead.
 */
export function descriptionToParagraphs(description) {
  const text = sanitizeDescriptionText(description);
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}
