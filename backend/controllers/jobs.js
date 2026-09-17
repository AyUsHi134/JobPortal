import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import * as jobService from "../services/jobService.js";

const VALID_SORTS = Object.keys(jobService.SORT_OPTIONS);

// The only values classifyLanguage (integrations/jobs/languageClassifier.js)
// ever assigns ("en"/"other"), plus "all" — the query-only sentinel
// jobService.buildJobFilter recognizes as "no language filter". Not derived
// from the Job schema (backend/models/Job.js's `language` field has no
// enum) since "all" isn't a storable value, only a query option.
const LANGUAGE_QUERY_VALUES = ["en", "other", "all"];

function parsePositiveInt(rawValue) {
  if (rawValue === undefined) return { ok: true, value: undefined };
  if (!/^\d+$/.test(String(rawValue))) return { ok: false };
  const n = Number(rawValue);
  if (!Number.isInteger(n) || n < 1) return { ok: false };
  return { ok: true, value: n };
}

function parseBooleanParam(rawValue) {
  if (rawValue === undefined) return { ok: true, value: undefined };
  if (rawValue === "true") return { ok: true, value: true };
  if (rawValue === "false") return { ok: true, value: false };
  return { ok: false };
}

const GUEST_COOKIE_NAME = "guestId";
const GUEST_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

/**
 * Mirrors middleware/auth.js's own Authorization-header/JWT check, but
 * never rejects the request — GET /api/jobs stays public either way. Used
 * only to decide whether guest job-view tracking applies to this request;
 * a missing, malformed, or invalid/expired token is simply treated as
 * "not authenticated" (the correct outcome for a genuine guest request
 * too), never surfaced as an error here.
 */
function isAuthenticatedRequest(req) {
  const header = typeof req.header === "function" ? req.header("Authorization") : undefined;
  if (!header) return false;
  const token = header.split(" ")[1];
  if (!token) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies the backend-enforced guest job-view limit to one GET /api/jobs
 * request: identifies/issues the `guestId` cookie, adds `jobsServedCount`
 * to that guest's cumulative in-memory total (jobService.recordGuestJobsServed),
 * and reports whether that guest has now reached GUEST_JOB_LIMIT. A no-op
 * (returns `false`, sets no cookie) for an authenticated request — logged-
 * in browsing is never capped, matching the frontend's own existing rule
 * (homepageJobsState.js's capJobsForGuest). `res.cookie` is called only
 * when available so this stays safe to run against the fixture `res`
 * objects backend/scripts/testJobListing.js and testJobSearch.js use,
 * which don't implement it.
 */
function applyGuestJobLimit(req, res, jobsServedCount) {
  if (isAuthenticatedRequest(req)) return false;

  let guestId = req.cookies && req.cookies[GUEST_COOKIE_NAME];
  if (!guestId) {
    guestId = randomUUID();
    if (typeof res.cookie === "function") {
      res.cookie(GUEST_COOKIE_NAME, guestId, { httpOnly: true, maxAge: GUEST_COOKIE_MAX_AGE_MS });
    }
  }

  const totalServed = jobService.recordGuestJobsServed(guestId, jobsServedCount);
  return totalServed >= jobService.GUEST_JOB_LIMIT;
}

/**
 * Parses and validates raw `req.query` into the typed options
 * `jobService.searchJobs` expects, or a list of human-readable error
 * messages. A pure function with no I/O — `experienceLevelEnumValues`
 * is passed in explicitly (rather than read from jobService internally)
 * so this can be unit-tested in complete isolation.
 *
 * Validation policy (documented in PHASE_1I2_REPORT.md §6): every
 * enum/boolean/numeric parameter is either a recognized value or absent
 * — an unrecognized value is a 400, never silently ignored or coerced
 * into a different query. `q`/`country`/`state`/`city`/`location`/
 * `source` are free-text/open string filters with no schema-enforced
 * enum to validate against; an empty string is treated the same as
 * "not provided" (a no-op filter, not an error).
 */
export function parseListJobsQuery(query, experienceLevelEnumValues) {
  const errors = [];
  const options = {};

  if (query.q !== undefined) {
    const q = String(query.q).trim();
    if (q.length > 200) errors.push("q must be 200 characters or fewer.");
    else if (q.length > 0) options.q = q;
  }

  if (query.experience_level !== undefined) {
    const value = String(query.experience_level).trim();
    if (!experienceLevelEnumValues.includes(value)) {
      errors.push(`experience_level must be one of: ${experienceLevelEnumValues.join(", ")}.`);
    } else {
      options.experience_level = value;
    }
  }

  const tech = parseBooleanParam(query.is_tech_relevant);
  if (!tech.ok) errors.push("is_tech_relevant must be 'true' or 'false'.");
  else if (tech.value !== undefined) options.is_tech_relevant = tech.value;

  const remote = parseBooleanParam(query.is_remote);
  if (!remote.ok) errors.push("is_remote must be 'true' or 'false'.");
  else if (remote.value !== undefined) options.is_remote = remote.value;

  // Left unset (not defaulted here) when absent — jobService.buildJobFilter
  // is responsible for defaulting an absent `language` option to "en";
  // this layer only validates/passes through an explicitly given value.
  if (query.language !== undefined) {
    const value = String(query.language).trim();
    if (!LANGUAGE_QUERY_VALUES.includes(value)) {
      errors.push(`language must be one of: ${LANGUAGE_QUERY_VALUES.join(", ")}.`);
    } else {
      options.language = value;
    }
  }

  for (const field of ["country", "state", "city", "location", "source"]) {
    if (query[field] !== undefined) {
      const value = String(query[field]).trim();
      if (value.length > 0) options[field] = value;
    }
  }

  if (query.sort !== undefined) {
    if (!VALID_SORTS.includes(query.sort)) {
      errors.push(`sort must be one of: ${VALID_SORTS.join(", ")}.`);
    } else {
      options.sort = query.sort;
    }
  } else {
    options.sort = jobService.DEFAULT_SORT;
  }

  const page = parsePositiveInt(query.page);
  if (!page.ok) errors.push("page must be a positive integer.");
  else options.page = page.value ?? jobService.DEFAULT_PAGE;

  const limit = parsePositiveInt(query.limit);
  if (!limit.ok) errors.push("limit must be a positive integer.");
  else options.limit = Math.min(limit.value ?? jobService.DEFAULT_LIMIT, jobService.MAX_LIMIT);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, options };
}

/**
 * Factory for the `GET /api/jobs` listing/search handler (Phase 1I-2,
 * extending Phase 1I-1). Returns an Express-compatible `(req, res) =>
 * ...` handler. Production code (routes/job.js, via the
 * default-configured `listJobs` export below) always calls this with no
 * arguments — this only exists so deterministic tests can get a handler
 * wired to a mocked `searchJobs` (see backend/scripts/testJobSearch.js
 * and backend/scripts/testJobListing.js) without touching MongoDB or
 * the route file itself.
 *
 * All HTTP/query-parameter parsing and response shaping happens here;
 * all MongoDB query construction/execution happens in jobService — this
 * file never builds a Mongo filter itself. Reads from MongoDB only —
 * never fetches Adzuna or RemoteOK, and never re-implements any
 * ingestion/query logic here.
 */
export function createListJobsHandler(deps = {}) {
  const searchJobs = deps.searchJobs || jobService.searchJobs;
  const experienceLevelEnumValues = deps.experienceLevelEnumValues || jobService.EXPERIENCE_LEVEL_VALUES;

  return async function listJobs(req, res) {
    const parsed = parseListJobsQuery(req.query || {}, experienceLevelEnumValues);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, error: "Invalid query parameters.", details: parsed.errors });
    }

    try {
      const { jobs, total } = await searchJobs(parsed.options);
      const { page, limit } = parsed.options;
      const guestLimitReached = applyGuestJobLimit(req, res, jobs.length);
      res.json({
        success: true,
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        guestLimitReached,
      });
    } catch (err) {
      // Never echoes err.message/err.stack to the client — a raw
      // Mongoose/MongoDB error can contain connection details. The real
      // message is logged server-side only.
      console.error("Failed to list jobs:", err.message);
      res.status(500).json({ success: false, error: "Failed to retrieve jobs. Please try again later." });
    }
  };
}

export const listJobs = createListJobsHandler();

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Factory for the `GET /api/jobs/:id` job-detail handler (Phase 1I-3),
 * mirroring `createListJobsHandler`'s injection-seam pattern so it can be
 * tested deterministically (backend/scripts/testJobDetails.js) without a
 * MongoDB connection.
 *
 * ID format validation happens here (an HTTP parameter concern), not in
 * the service — an invalid ObjectId string passed straight to Mongoose
 * throws a CastError, which nothing in this codebase currently catches
 * as a global error handler, so it must be rejected as a `400` before
 * ever reaching `jobService`. All lifecycle (`status: "active"`) and
 * field-whitelist logic lives in `jobService.getActiveJobById`, not
 * here.
 */
export function createGetJobHandler(deps = {}) {
  const getActiveJobById = deps.getActiveJobById || jobService.getActiveJobById;

  return async function getJob(req, res) {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid job ID." });
    }

    try {
      const job = await getActiveJobById(id);
      if (!job) {
        return res.status(404).json({ success: false, error: "Job not found." });
      }
      res.json({ success: true, data: job });
    } catch (err) {
      // Never echoes err.message/err.stack to the client — see the same
      // policy applied in createListJobsHandler.
      console.error("Failed to get job:", err.message);
      res.status(500).json({ success: false, error: "Failed to retrieve job. Please try again later." });
    }
  };
}

export const getJob = createGetJobHandler();

// Turns a Mongoose ValidationError into a clean 400 with per-field
// messages, mirroring the {success, error, details} shape
// parseListJobsQuery's 400s already use — never lets a raw Mongoose
// error object/stack reach the client.
function validationErrorDetails(err) {
  return Object.values(err.errors || {}).map((e) => e.message);
}

/**
 * Phase 1I-5 audit fix: createJob/updateJob/removeJob previously had no
 * try/catch at all (an unhandled rejection — e.g. a schema validation
 * failure, or a malformed :id CastError — would fall through to
 * Express 5's default error handler, which can include a stack trace in
 * the response since this app never sets NODE_ENV=production), no id
 * format validation on the write-by-id routes, and returned the raw
 * Mongoose document (leaking internal fields like `dedup_fingerprint`/
 * `__v`/`createdAt`/`updatedAt`) in a shape inconsistent with the
 * {success, data} convention `listJobs`/`getJob` already use. All three
 * now follow that same convention, and reuse the same `deps`-injection
 * factory pattern as createListJobsHandler/createGetJobHandler so
 * backend/scripts/testJobMutationSecurity.js can exercise the response-
 * shaping/error-handling/id-validation logic deterministically (a mocked
 * jobService, no MongoDB connection). req.body -> MongoDB-document
 * field-whitelisting itself is proven separately and more precisely at
 * the pure-function level (jobService.pickManualJobFields), since that's
 * what actually determines which fields can ever reach a Mongo write —
 * this layer only handles HTTP concerns, per the established
 * Route → Controller → Service → Model split.
 */
export function createCreateJobHandler(deps = {}) {
  const createManualJob = deps.createManualJob || jobService.createManualJob;
  const toPublicJob = deps.toPublicJob || jobService.toPublicJob;

  return async function createJob(req, res) {
    try {
      const job = await createManualJob(req.body);
      res.status(201).json({ success: true, data: toPublicJob(job) });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ success: false, error: "Invalid job data.", details: validationErrorDetails(err) });
      }
      console.error("Failed to create job:", err.message);
      res.status(500).json({ success: false, error: "Failed to create job. Please try again later." });
    }
  };
}
export const createJob = createCreateJobHandler();

export function createUpdateJobHandler(deps = {}) {
  const updateJobById = deps.updateJobById || jobService.updateJobById;
  const toPublicJob = deps.toPublicJob || jobService.toPublicJob;

  return async function updateJob(req, res) {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid job ID." });
    }

    try {
      const job = await updateJobById(id, req.body);
      if (!job) return res.status(404).json({ success: false, error: "Job not found." });
      res.json({ success: true, data: toPublicJob(job) });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ success: false, error: "Invalid job data.", details: validationErrorDetails(err) });
      }
      console.error("Failed to update job:", err.message);
      res.status(500).json({ success: false, error: "Failed to update job. Please try again later." });
    }
  };
}
export const updateJob = createUpdateJobHandler();

export function createRemoveJobHandler(deps = {}) {
  const deleteJobById = deps.deleteJobById || jobService.deleteJobById;

  return async function removeJob(req, res) {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid job ID." });
    }

    try {
      await deleteJobById(id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to delete job:", err.message);
      res.status(500).json({ success: false, error: "Failed to delete job. Please try again later." });
    }
  };
}
export const removeJob = createRemoveJobHandler();
