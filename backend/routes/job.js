import express from "express";
import Job from "../models/Job.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
   const jobs = await Job.find();
    console.log("Fetched jobs:", jobs);
  res.json(jobs);
} catch(error) {
  res.status(500).json({ error: err.message });
}
  
});

router.post("/", async (req, res) => {
  const job = new Job(req.body);
  await job.save();
  res.status(201).json(job);
});

router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ msg: "Job not found" });
  res.json(job);
});

export default router;
