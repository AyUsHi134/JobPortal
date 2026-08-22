import express from "express";
import authMiddleware from "../middleware/auth.js";
import { listJobs, getJob, createJob, updateJob, removeJob } from "../controllers/jobs.js";

const router = express.Router();

// GET all jobs — public, unchanged
router.get("/", listJobs);

// GET one job by ID — public, unchanged
router.get("/:id", getJob);

// POST/PUT/DELETE mutate shared job data and were previously fully
// unauthenticated. This route file's own original comment already
// intended "admin only" for job creation, but the User schema has no
// admin/role field to enforce that distinction with — per this phase's
// explicit instruction not to invent a fake authorization mechanism,
// requiring a valid authenticated session is the strongest control the
// current data model actually supports. See PHASE_1I4_REPORT.md §6/§7
// for the full reasoning and its documented limitation.
router.post("/", authMiddleware, createJob);
router.put("/:id", authMiddleware, updateJob);
router.delete("/:id", authMiddleware, removeJob);

export default router;
