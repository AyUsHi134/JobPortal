import Job from "../models/Job.js";
import { computeDedupFingerprint } from "./dedupFingerprint.js";

export async function listJobs(filter = {}) {
  return Job.find(filter);
}

// Fields exposed to the frontend by the default job-listing endpoint
// (Phase 1I-1). Deliberately excludes internal/operational bookkeeping
// that isn't part of what a public job listing needs: `dedup_fingerprint`
// (an internal soft-duplicate signal, not user-facing — JOB_SCHEMA_DESIGN.md
// §7), `hiring_stage` (a separate, pre-existing internal concept per
// backend/models/Job.js's own comment), `last_seen_at`/`expires_at`
// (ingestion-freshness bookkeeping, not "date information" a job seeker
// needs), and Mongoose's own `createdAt`/`updatedAt`/`__v`. `_id` is
// always included by Mongoose unless explicitly excluded, which is
// wanted here as the job's identity for the frontend.
const PUBLIC_LISTING_FIELDS_LIST = [
  "title",
  "company",
  "description",
  "apply_link",
  "location",
  "salary",
  "job_type",
  "is_remote",
  "experience_level",
  "is_tech_relevant",
  "tech_relevance_source",
  "source_category",
  "tags",
  "normalized_skills",
  "logo",
  "date_posted",
  "status",
  "source",
  "source_id",
];
const PUBLIC_LISTING_FIELDS = PUBLIC_LISTING_FIELDS_LIST.join(" ");

// The schema's own approved enum, read directly from the Mongoose model
// rather than duplicated here — keeps the API's validation perfectly in
// sync with backend/models/Job.js (the source of truth) with zero risk
// of drift if that enum is ever extended.
export const EXPERIENCE_LEVEL_VALUES = Job.schema.path("experience_level").enumValues;

// Small, fixed, documented set of sort options (Phase 1I-2 §7/§3 of the
// report). "newest" matches Phase 1I-1's own default and reuses the
// existing {status:1, date_posted:-1} index. "salary_high" sorts by
// salary.max descending — MongoDB sorts null/missing as lower than any
// number, so jobs with a real salary naturally surface before jobs with
// none, which is the "meaningful" behavior the task asked for; no index
// exists for this and none is added (see jobService's index-decision
// notes / PHASE_1I2_REPORT.md §7 — the current ~113-active-job volume
// makes an in-memory sort trivially fast).
export const SORT_OPTIONS = {
  newest: { date_posted: -1 },
  oldest: { date_posted: 1 },
  salary_high: { "salary.max": -1, date_posted: -1 },
};
export const DEFAULT_SORT = "newest";
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Escapes every regex metacharacter so a user-supplied search string can
// only ever match itself literally — this is what makes building a
// $regex filter from raw user input safe: the resulting pattern has no
// repetition/alternation operators of its own, so it cannot be crafted
// into a catastrophic-backtracking (ReDoS) expression regardless of the
// input's length or content.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the MongoDB filter for `searchJobs` from already-validated,
 * already-typed options (validation/parsing of raw req.query happens in
 * the controller — this only ever receives clean values). Exported for
 * direct, isolated testing of query-shape correctness.
 *
 * Keyword search (`q`) deliberately does NOT use MongoDB's $text/text
 * index: the existing text index (title/tags/normalized_skills) already
 * exists on the live collection, and MongoDB permits only one text index
 * per collection — extending it to also cover company/description (as
 * this phase's search requirement needs) would require dropping and
 * recreating a live production index for a marginal benefit at the
 * current ~113-active-job scale. A safe, escaped, case-insensitive
 * regex $or across the exact fields the task asks for (title, company,
 * description, normalized_skills) satisfies the requirement natively,
 * with no external search engine and no index migration risk. See
 * PHASE_1I2_REPORT.md §7 for the full reasoning.
 */
export function buildJobFilter(options = {}) {
  const filter = { status: "active" };
  const andClauses = [];

  if (options.q) {
    const pattern = new RegExp(escapeRegex(options.q), "i");
    andClauses.push({
      $or: [{ title: pattern }, { company: pattern }, { description: pattern }, { normalized_skills: pattern }],
    });
  }

  if (options.experience_level) filter.experience_level = options.experience_level;
  if (options.is_tech_relevant !== undefined) filter.is_tech_relevant = options.is_tech_relevant;
  if (options.is_remote !== undefined) filter.is_remote = options.is_remote;
  if (options.source) filter.source = options.source;

  // Country/state/city: case-insensitive EXACT match (anchored ^...$)
  // against structured, source-provided values — never partial, since
  // these are closer to a controlled vocabulary (e.g. "India") than
  // free text. The anchors + escaping make this immune to ReDoS and to
  // accidentally matching an unrelated substring.
  if (options.country) filter["location.country"] = new RegExp(`^${escapeRegex(options.country)}$`, "i");
  if (options.state) filter["location.state"] = new RegExp(`^${escapeRegex(options.state)}$`, "i");
  if (options.city) filter["location.city"] = new RegExp(`^${escapeRegex(options.city)}$`, "i");

  // `location`: a broader, partial, free-text match against the raw/
  // display strings, for callers who don't know the exact structured
  // value (e.g. searching "bangalore" against "Bangalore, Karnataka").
  if (options.location) {
    const pattern = new RegExp(escapeRegex(options.location), "i");
    andClauses.push({ $or: [{ "location.raw": pattern }, { "location.display_name": pattern }] });
  }

  // Combined carefully: a plain object can only hold one $or key, so if
  // both `q` and `location` produced their own $or clause, they're
  // combined via $and instead of the second silently overwriting the
  // first.
  if (andClauses.length === 1) {
    Object.assign(filter, andClauses[0]);
  } else if (andClauses.length > 1) {
    filter.$and = andClauses;
  }

  return filter;
}

/**
 * The query `GET /api/jobs` uses (Phase 1I-2): `status: "active"` plus
 * whatever optional search/filter options are given, sorted per
 * `options.sort` (defaulting to "newest"), paginated per `options.page`/
 * `options.limit` (both expected to already be resolved, positive
 * integers by the time they reach here — the controller is responsible
 * for defaulting/validating/clamping raw query-string input before
 * calling this). Returns both the page of jobs and the total match count
 * (needed for pagination metadata), computed as two simple, independent
 * queries rather than a single $facet aggregation — simpler to read, and
 * at the current data volume the extra round trip is not a meaningful
 * cost (see PHASE_1I2_REPORT.md §7).
 */
export async function searchJobs(options = {}) {
  const filter = buildJobFilter(options);
  const sort = SORT_OPTIONS[options.sort] || SORT_OPTIONS[DEFAULT_SORT];
  const page = options.page || DEFAULT_PAGE;
  const limit = options.limit || DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    Job.find(filter).select(PUBLIC_LISTING_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  return { jobs, total };
}

export async function getJobById(id) {
  return Job.findById(id);
}

/**
 * The query `GET /api/jobs/:id` uses (Phase 1I-3). Reuses the exact same
 * lifecycle restriction (`status: "active"` — never a legacy status-less
 * document, never expired/filled/removed) and the exact same public
 * field whitelist (`PUBLIC_LISTING_FIELDS`) that `searchJobs` already
 * established for the listing endpoint, so a job detail page can never
 * show a job the listing itself wouldn't, and can never leak a field the
 * listing wouldn't. `_id` is implicitly matched via Mongoose's own
 * CastError-on-malformed-input behavior; the controller is responsible
 * for rejecting a malformed id with a 400 *before* calling this, so this
 * only ever runs against an already-validated ObjectId string. Returns
 * `null` when no active job with that id exists (nonexistent id *or* an
 * id belonging to an inactive job) — the controller turns that into a
 * 404 either way, so this endpoint never reveals whether an id belongs
 * to a real-but-inactive job.
 */
export async function getActiveJobById(id) {
  return Job.findOne({ _id: id, status: "active" }).select(PUBLIC_LISTING_FIELDS).lean();
}

/**
 * Shapes a just-written Mongoose Job document (from createManualJob/
 * updateJobById) down to the same public field whitelist `searchJobs`/
 * `getActiveJobById` already use, so `POST`/`PUT /api/jobs` return the
 * same job shape a client would later see from `GET /api/jobs`/`GET
 * /api/jobs/:id` (Phase 1I-5 audit fix — the create/update endpoints
 * previously returned the full raw document, including internal fields
 * like `dedup_fingerprint`/`__v`/`createdAt`/`updatedAt`).
 */
export function toPublicJob(jobDoc) {
  if (!jobDoc) return jobDoc;
  const obj = typeof jobDoc.toObject === "function" ? jobDoc.toObject() : jobDoc;
  const picked = { _id: obj._id };
  for (const field of PUBLIC_LISTING_FIELDS_LIST) {
    picked[field] = obj[field];
  }
  return picked;
}

/**
 * Whitelists `req.body` down to genuine Job content fields before it ever
 * reaches a Mongoose write, for the manual create/update endpoints
 * (Phase 1I-5 audit fix). Reuses `UPSERT_CONTENT_FIELDS` (defined below,
 * already the established "safe job content" whitelist for the ingestion
 * pipeline) rather than a second, duplicated list.
 *
 * This closes two real gaps found in the final audit:
 *  - `updateJobById` previously passed `req.body` straight through to
 *    `Job.findByIdAndUpdate(id, data, ...)` as the raw MongoDB update
 *    document. Since Mongoose does not distinguish "a developer wrote
 *    $unset deliberately" from "a client sent {"$unset": {...}} in JSON",
 *    an unauthenticated-looking but now merely non-admin authenticated
 *    caller could smuggle real Mongo update operators ($unset, $rename,
 *    $inc, ...) through the request body. Wrapping the whitelisted result
 *    in an explicit `$set` and never forwarding anything else closes this
 *    off entirely — no client-supplied key outside the whitelist can ever
 *    reach the driver.
 *  - `createManualJob` previously spread `req.body` directly into `new
 *    Job(...)`, letting a client mass-assign internal/lifecycle fields
 *    (`status`, `dedup_fingerprint`, `expires_at`, `hiring_stage`,
 *    `last_seen_at`) it should never control directly.
 */
export function pickManualJobFields(data) {
  const picked = {};
  for (const field of UPSERT_CONTENT_FIELDS) {
    if (data && data[field] !== undefined) picked[field] = data[field];
  }
  return picked;
}

export async function createManualJob(data) {
  const job = new Job({ ...pickManualJobFields(data), source: "manual" });
  return job.save();
}

export async function updateJobById(id, data) {
  const update = pickManualJobFields(data);
  return Job.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
}

export async function deleteJobById(id) {
  return Job.findByIdAndDelete(id);
}

// Reusable upsert boundary for future source adapters (Adzuna, RemoteOK,
// etc.) to call directly, without going through HTTP routes. Callers are
// responsible for passing an already-normalized job object per
// JOB_SCHEMA_DESIGN.md — this function performs no source-specific field
// mapping, normalization, or classification of its own.
export async function upsertJobBySource(source, sourceId, normalizedFields) {
  return Job.findOneAndUpdate(
    { source, source_id: sourceId },
    {
      $set: { ...normalizedFields, source, source_id: sourceId, last_seen_at: new Date() },
      // Only set on first insert, so re-ingesting a job the source still
      // lists never silently reverts an expired/filled/removed status
      // back to active.
      $setOnInsert: { status: "active" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Fields a normalized+classified job (see backend/integrations/jobs/) is
// allowed to write. Deliberately an explicit whitelist rather than a
// blind spread of the whole job object: if a caller ever accidentally
// re-feeds an already-persisted Mongo document back through this
// pipeline (which would carry its own _id/status/expires_at/createdAt/
// updatedAt), a blind spread would defeat the lifecycle protections
// below. status/expires_at/hiring_stage/_id/createdAt/updatedAt are
// never included here on purpose.
const UPSERT_CONTENT_FIELDS = [
  "title",
  "company",
  "description",
  "apply_link",
  "location",
  "tags",
  "normalized_skills",
  "salary",
  "job_type",
  "is_remote",
  "experience_level",
  "is_tech_relevant",
  "tech_relevance_source",
  "source_category",
  "logo",
  "date_posted", // only included if actually present, per Phase 1E's "omit when unknown" convention
];

export function buildUpsertSet(job) {
  const set = {};
  for (const field of UPSERT_CONTENT_FIELDS) {
    if (field === "date_posted" && !job.date_posted) continue; // let the schema default apply on insert; leave untouched on update
    if (job[field] !== undefined) set[field] = job[field];
  }
  return set;
}

/**
 * Persists one already-normalized-and-classified Job object (the output
 * of backend/integrations/jobs/classifyJob.js) using the approved
 * {source, source_id} identity as the sole authoritative dedup key.
 *
 * - Re-ingesting the same source/source_id updates the existing record
 *   (idempotent) rather than creating a duplicate, enforced by the
 *   partial unique index in backend/models/Job.js.
 * - `status` is only ever set via $setOnInsert, so re-ingestion can
 *   never silently revert an expired/filled/removed job back to active.
 * - `expires_at` and `hiring_stage` are never touched by this function —
 *   they are left exactly as they were (or at their schema default on
 *   first insert), per JOB_SCHEMA_DESIGN.md's lifecycle strategy.
 * - `last_seen_at` is always refreshed to "now" on every successful
 *   observation, insert or update alike.
 * - `dedup_fingerprint` (JOB_SCHEMA_DESIGN.md §7) is computed here and
 *   checked against OTHER sources' fingerprints as a soft, non-blocking
 *   cross-source-duplicate signal — a match is reported, never used to
 *   skip, merge, or delete anything.
 *
 * Returns an outcome object:
 *   { status: "inserted"|"updated"|"skipped_invalid", source, source_id,
 *     jobId, dedupFingerprint, crossSourceDuplicates: [...], reason? }
 * Throws only on a genuine database/validation error (e.g. a malformed
 * job missing a schema-required field) — callers processing a batch
 * (see jobIngestionPipeline.js) are expected to catch this per job.
 */
export async function upsertClassifiedJob(job) {
  const source = job && typeof job.source === "string" ? job.source.trim() : "";
  const sourceId = job && typeof job.source_id === "string" ? job.source_id.trim() : "";

  if (!source || !sourceId) {
    return {
      status: "skipped_invalid",
      source: source || null,
      source_id: sourceId || null,
      reason: "Missing or invalid source/source_id — cannot establish persistence identity.",
      jobId: null,
      dedupFingerprint: null,
      crossSourceDuplicates: [],
    };
  }

  const dedupFingerprint = computeDedupFingerprint(job);

  const crossSourceMatches = await Job.find({
    dedup_fingerprint: dedupFingerprint,
    source: { $ne: source },
  })
    .select("_id source source_id title company")
    .lean();

  const setFields = buildUpsertSet(job);
  setFields.source = source;
  setFields.source_id = sourceId;
  setFields.dedup_fingerprint = dedupFingerprint;
  setFields.last_seen_at = new Date();

  // findOneAndUpdate's runValidators option (below) only validates paths
  // that are actually present in $set — Mongoose's update validators do
  // not enforce `required` for a path that's simply absent from the
  // update, even on an upsert. A malformed job missing e.g. title/company/
  // description/location would otherwise upsert successfully with those
  // fields absent. Validating an in-memory document built from the exact
  // $set content (same technique as this file's own test coverage) closes
  // that gap by applying full schema validation, including `required`,
  // before any write is attempted.
  await new Job(setFields).validate();

  const rawResult = await Job.findOneAndUpdate(
    { source, source_id: sourceId },
    {
      $set: setFields,
      $setOnInsert: { status: "active" },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      includeResultMetadata: true,
      runValidators: true,
    }
  );

  const wasUpdate = Boolean(rawResult.lastErrorObject && rawResult.lastErrorObject.updatedExisting);

  return {
    status: wasUpdate ? "updated" : "inserted",
    source,
    source_id: sourceId,
    jobId: rawResult.value._id,
    dedupFingerprint,
    crossSourceDuplicates: crossSourceMatches.map((m) => ({
      _id: m._id,
      source: m.source,
      source_id: m.source_id,
      title: m.title,
      company: m.company,
    })),
  };
}
