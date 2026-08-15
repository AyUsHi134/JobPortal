import express from "express";
import Job from "../models/Job.js";

const router = express.Router();

// GET all jobs
router.get("/", async (req, res) => {
  const jobs = await Job.find({});
  res.json(jobs);
});

// GET one job by ID
router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// POST: Add new manual job (admin only)
router.post("/", async (req, res) => {
  const job = new Job({ ...req.body, source: "manual" });
  await job.save();
  res.status(201).json(job);
});

// PUT: Update a job
router.put("/:id", async (req, res) => {
  const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// DELETE: Remove a job
router.delete("/:id", async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

export default router;
