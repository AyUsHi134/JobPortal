import express from "express";
import authMiddleware from "../middleware/auth.js";
import { listJobs, getJob, createJob, updateJob, removeJob } from "../controllers/jobs.js";

const router = express.Router();

// GET all jobs, public
router.get("/", listJobs);

// GET one job, public
router.get("/:id", getJob);

// Writes require authentication
router.post("/", authMiddleware, createJob);
router.put("/:id", authMiddleware, updateJob);
router.delete("/:id", authMiddleware, removeJob);

export default router;
