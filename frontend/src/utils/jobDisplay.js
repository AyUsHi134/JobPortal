// Pure honest formatting helpers

/** Cleans stray location commas */
function cleanLocationText(text) {
  if (typeof text !== "string") return null;
  const cleaned = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return cleaned || null;
}

/** Location fallback order */
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

// Fixed en-US locale
function formatMoney(amount) {
  return typeof amount === "number" ? amount.toLocaleString("en-US") : String(amount);
}

/** Salary formatting, null if unknown */
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

/** Never labels unknown experience */
export function formatExperience(level) {
  return EXPERIENCE_LABELS[level] || null;
}

// Badge tone by experience level
export function getExperienceBadgeTone(level) {
  if (!EXPERIENCE_LABELS[level]) return null;
  return level === "fresher" || level === "entry" ? "entry" : "senior";
}

/** Tri-state remote flag */
export function formatRemote(isRemote) {
  if (isRemote === true) return "Remote";
  if (isRemote === false) return "On-site";
  return null;
}

/** Remote badge signal only */
export function formatRemoteBadge(isRemote) {
  return isRemote === true ? "Remote" : null;
}

/** Positive Tech signal only */
export function formatTechRelevance(isTechRelevant) {
  return isTechRelevant === true ? "Tech" : null;
}

const SOURCE_LABELS = { adzuna: "Adzuna", remoteok: "RemoteOK" };

/** Omits manual and unknown sources */
export function formatSource(source) {
  return SOURCE_LABELS[source] || null;
}

/** Relative posted date */
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

/** Detects duplicate Remote location */
export function isDuplicateRemoteLocation(isRemoteConfirmed, locationText) {
  if (!isRemoteConfirmed || !locationText) return false;
  return locationText.trim().toLowerCase() === "remote";
}

/** Only http(s) links valid */
export function isValidApplyLink(link) {
  return typeof link === "string" && /^https?:\/\//i.test(link.trim());
}

/** Strips markup to plain text */
export function sanitizeDescriptionText(description) {
  if (typeof description !== "string" || !description.trim()) return null;

  const withLineBreaks = description
    // Block boundaries become newlines
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    // Drop remaining tags
    .replace(/<[^>]*>/g, "");

  return withLineBreaks
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
}

/** Splits description into paragraphs */
export function descriptionToParagraphs(description) {
  const text = sanitizeDescriptionText(description);
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}
