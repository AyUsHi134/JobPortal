import Job from "../models/Job.js";
import { computeDedupFingerprint } from "./dedupFingerprint.js";
import {
  decodeHtmlEntities,
  repairMojibake,
  isPlaceholderOrGarbledTitle,
} from "../integrations/jobs/normalizationHelpers.js";

export async function listJobs(filter = {}) {
  return Job.find(filter);
}

// Public listing fields whitelist
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
  "language",
  "tags",
  "normalized_skills",
  "logo",
  "date_posted",
  "status",
  "source",
  "source_id",
];
const PUBLIC_LISTING_FIELDS = PUBLIC_LISTING_FIELDS_LIST.join(" ");

// Search fields, description excluded
const PUBLIC_SEARCH_RESULT_FIELDS = PUBLIC_LISTING_FIELDS_LIST.filter((field) => field !== "description").join(" ");

// Enum read from model
export const EXPERIENCE_LEVEL_VALUES = Job.schema.path("experience_level").enumValues;

// Fixed sort options
export const SORT_OPTIONS = {
  newest: { date_posted: -1 },
  oldest: { date_posted: 1 },
  salary_high: { "salary.max": -1, date_posted: -1 },
};
export const DEFAULT_SORT = "newest";
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Backend guest limit, in-memory
export const GUEST_JOB_LIMIT = 40;
const guestJobCounts = new Map();

/** Adds served jobs to guest */
export function recordGuestJobsServed(guestId, count) {
  const total = (guestJobCounts.get(guestId) || 0) + count;
  guestJobCounts.set(guestId, total);
  return total;
}

// Escapes regex metacharacters (ReDoS-safe)
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds MongoDB filter from options */
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

  // Language defaults to English
  if (options.language === undefined) {
    filter.language = "en";
  } else if (options.language !== "all") {
    filter.language = options.language;
  }

  // Exact case-insensitive location match
  if (options.country) filter["location.country"] = new RegExp(`^${escapeRegex(options.country)}$`, "i");
  if (options.state) filter["location.state"] = new RegExp(`^${escapeRegex(options.state)}$`, "i");
  if (options.city) filter["location.city"] = new RegExp(`^${escapeRegex(options.city)}$`, "i");

  // Partial free-text location match
  if (options.location) {
    const pattern = new RegExp(escapeRegex(options.location), "i");
    andClauses.push({ $or: [{ "location.raw": pattern }, { "location.display_name": pattern }] });
  }

  // Combine $or clauses via $and
  if (andClauses.length === 1) {
    Object.assign(filter, andClauses[0]);
  } else if (andClauses.length > 1) {
    filter.$and = andClauses;
  }

  return filter;
}

/** Paginated active job search */
export async function searchJobs(options = {}) {
  const filter = buildJobFilter(options);
  const sort = SORT_OPTIONS[options.sort] || SORT_OPTIONS[DEFAULT_SORT];
  const page = options.page || DEFAULT_PAGE;
  const limit = options.limit || DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    Job.find(filter).select(PUBLIC_SEARCH_RESULT_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  return { jobs, total };
}

export async function getJobById(id) {
  return Job.findById(id);
}

/** Fetches one active job */
export async function getActiveJobById(id) {
  return Job.findOne({ _id: id, status: "active" }).select(PUBLIC_LISTING_FIELDS).lean();
}

/** Shapes job to public fields */
export function toPublicJob(jobDoc) {
  if (!jobDoc) return jobDoc;
  const obj = typeof jobDoc.toObject === "function" ? jobDoc.toObject() : jobDoc;
  const picked = { _id: obj._id };
  for (const field of PUBLIC_LISTING_FIELDS_LIST) {
    picked[field] = obj[field];
  }
  return picked;
}

/** Whitelists body to content fields */
const MANUAL_JOB_CLEAN_TEXT_FIELDS = ["title", "company", "description"];
const MANUAL_JOB_LOCATION_TEXT_FIELDS = ["raw", "display_name", "city", "state", "country"];

// Clean manual text like ingestion
function cleanManualJobFields(picked) {
  for (const field of MANUAL_JOB_CLEAN_TEXT_FIELDS) {
    if (typeof picked[field] === "string") {
      picked[field] = decodeHtmlEntities(repairMojibake(picked[field]));
    }
  }
  if (picked.location && typeof picked.location === "object") {
    const cleanedLocation = { ...picked.location };
    for (const field of MANUAL_JOB_LOCATION_TEXT_FIELDS) {
      if (typeof cleanedLocation[field] === "string") {
        cleanedLocation[field] = decodeHtmlEntities(repairMojibake(cleanedLocation[field]));
      }
    }
    picked.location = cleanedLocation;
  }
  return picked;
}

export function pickManualJobFields(data) {
  const picked = {};
  for (const field of UPSERT_CONTENT_FIELDS) {
    if (data && data[field] !== undefined) picked[field] = data[field];
  }
  return cleanManualJobFields(picked);
}

export async function createManualJob(data) {
  const fields = pickManualJobFields(data);

  // Rejects garbled titles like ingestion
  if (typeof fields.title === "string" && isPlaceholderOrGarbledTitle(fields.title)) {
    const err = new Error("Invalid job data.");
    err.name = "ValidationError";
    err.errors = {
      title: { message: `Title rejected as placeholder/garbled/non-English: "${fields.title}".` },
    };
    throw err;
  }

  const job = new Job({ ...fields, source: "manual" });
  return job.save();
}

export async function updateJobById(id, data) {
  const update = pickManualJobFields(data);
  return Job.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
}

export async function deleteJobById(id) {
  return Job.findByIdAndDelete(id);
}

// Reusable upsert for sources
export async function upsertJobBySource(source, sourceId, normalizedFields) {
  return Job.findOneAndUpdate(
    { source, source_id: sourceId },
    {
      $set: { ...normalizedFields, source, source_id: sourceId, last_seen_at: new Date() },
      // Set only on first insert
      $setOnInsert: { status: "active" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Explicit whitelist of writable fields
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
  "language",
  "logo",
  "date_posted", // Only if present
];

export function buildUpsertSet(job) {
  const set = {};
  for (const field of UPSERT_CONTENT_FIELDS) {
    if (field === "date_posted" && !job.date_posted) continue; // Schema default applies on insert
    if (job[field] !== undefined) set[field] = job[field];
  }
  return set;
}

/** Upserts one classified job */
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

  // Validate in-memory before write
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
