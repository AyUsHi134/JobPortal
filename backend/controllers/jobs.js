import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import * as jobService from "../services/jobService.js";

const VALID_SORTS = Object.keys(jobService.SORT_OPTIONS);

// Allowed language filter values
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
const GUEST_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Optional JWT check, never rejects */
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

/** Enforces guest job-view limit */
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

/** Validates and parses query params */
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

  // Unset; service defaults language
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

/** Job listing handler factory */
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
      // Never leaks error details
      console.error("Failed to list jobs:", err.message);
      res.status(500).json({ success: false, error: "Failed to retrieve jobs. Please try again later." });
    }
  };
}

export const listJobs = createListJobsHandler();

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

/** Job detail handler factory */
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
      // Never leaks error details
      console.error("Failed to get job:", err.message);
      res.status(500).json({ success: false, error: "Failed to retrieve job. Please try again later." });
    }
  };
}

export const getJob = createGetJobHandler();

// Maps validation errors to 400
function validationErrorDetails(err) {
  return Object.values(err.errors || {}).map((e) => e.message);
}

/** Hardened job write handlers */
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
