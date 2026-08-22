import { createHash } from "node:crypto";

// Implements the fallback cross-source duplicate signal exactly as
// specified in JOB_SCHEMA_DESIGN.md §7: a hash of
// normalize(title) + "|" + normalize(company) + "|" + normalize(location.city || location.raw),
// where normalize() lowercases, trims, and collapses whitespace. This is
// deliberately a SOFT signal, never a hard uniqueness constraint — the
// {source, source_id} compound key remains the only authoritative
// identity (see backend/models/Job.js's partial unique index).
//
// SHA-256 is used and truncated to 16 hex characters (64 bits) — more
// than enough collision resistance for a soft duplicate-review signal at
// this project's scale, while keeping the stored/indexed value small.

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
