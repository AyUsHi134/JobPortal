import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getProfile, updateProfile, saveJob, isJobSaved, unsaveJob } from "../controllers/user.js";

const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

// Save job requires authentication
router.post("/savejob", authMiddleware, saveJob);

// Check saved, requires authentication
router.post("/issaved", authMiddleware, isJobSaved);

// Unsave job, owner from JWT
router.post("/unsavejob", authMiddleware, unsaveJob);

export default router;
