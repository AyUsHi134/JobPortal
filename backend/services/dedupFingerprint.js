import { createHash } from "node:crypto";

// Soft duplicate fingerprint hash

function normalizeForFingerprint(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function computeDedupFingerprint(job) {
  const title = normalizeForFingerprint(job && job.title);
  const company = normalizeForFingerprint(job && job.company);
  const location = normalizeForFingerprint(
    (job && job.location && (job.location.city || job.location.raw)) || null
  );

  const composite = `${title}|${company}|${location}`;
  return createHash("sha256").update(composite).digest("hex").slice(0, 16);
}
