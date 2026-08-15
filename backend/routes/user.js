import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js"; // your JWT middleware

const router = express.Router();

router.get("/profile", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

router.put("/profile", authMiddleware, async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user.id);
  if (name) user.name = name;
  if (email) user.email = email;
  await user.save();
  res.json(user);
});

// Save Job
router.post('/savejob', async (req, res) => {
  try {
    const { userId, jobId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.savedJobs.includes(jobId)) {
      user.savedJobs.push(jobId);
      await user.save();
    }
    res.json({ success: true, savedJobs: user.savedJobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if Job is Saved (optional)
router.post('/issaved', async (req, res) => {
  const { userId, jobId } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const isSaved = user.savedJobs.includes(jobId);
  res.json({ isSaved });
});

export default router;


