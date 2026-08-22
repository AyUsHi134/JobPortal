import express from "express";
import authMiddleware from "../middleware/auth.js";
import { getProfile, updateProfile, saveJob, isJobSaved } from "../controllers/user.js";

const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

// Save Job — requires authentication (Phase 1I-4). Previously
// unprotected and keyed off a client-supplied `userId`, letting any
// caller save a job onto any other user's account. See PHASE_1I4_REPORT.md.
router.post("/savejob", authMiddleware, saveJob);

// Check if Job is Saved — same fix, same reason.
router.post("/issaved", authMiddleware, isJobSaved);

export default router;
