import mongoose from "mongoose";
import User from "../models/User.js";

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

// Strips password hash from responses
function sanitizeUser(userDoc) {
  const obj = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  return obj;
}

/** Handlers use injectable deps factory */
export function createGetProfileHandler(deps = {}) {
  const UserModel = deps.User || User;

  return async function getProfile(req, res) {
    try {
      const user = await UserModel.findById(req.user.id).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("Failed to get profile:", err.message);
      res.status(500).json({ error: "Failed to retrieve profile. Please try again later." });
    }
  };
}
export const getProfile = createGetProfileHandler();

export function createUpdateProfileHandler(deps = {}) {
  const UserModel = deps.User || User;

  return async function updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      // Always caller's own profile
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (name) user.name = name;
      if (email) user.email = email;
      await user.save();

      res.json(sanitizeUser(user));
    } catch (err) {
      // Duplicate email returns clean 400
      if (err.code === 11000) {
        return res.status(400).json({ error: "Email already in use." });
      }
      console.error("Failed to update profile:", err.message);
      res.status(500).json({ error: "Failed to update profile. Please try again later." });
    }
  };
}
export const updateProfile = createUpdateProfileHandler();

export function createSaveJobHandler(deps = {}) {
  const UserModel = deps.User || User;

  return async function saveJob(req, res) {
    try {
      const { jobId } = req.body;
      if (!isValidObjectId(jobId)) {
        return res.status(400).json({ error: "Invalid job ID." });
      }

      // Owner is always req.user.id
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Compare ids as strings
      if (!user.savedJobs.some((id) => id.toString() === jobId)) {
        user.savedJobs.push(jobId);
        await user.save();
      }
      res.json({ success: true, savedJobs: user.savedJobs });
    } catch (err) {
      console.error("Failed to save job:", err.message);
      res.status(500).json({ error: "Failed to save job. Please try again later." });
    }
  };
}
export const saveJob = createSaveJobHandler();

export function createIsJobSavedHandler(deps = {}) {
  const UserModel = deps.User || User;

  return async function isJobSaved(req, res) {
    try {
      const { jobId } = req.body;
      if (!isValidObjectId(jobId)) {
        return res.status(400).json({ error: "Invalid job ID." });
      }

      // Always caller's own saved jobs
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const isSaved = user.savedJobs.some((id) => id.toString() === jobId);
      res.json({ isSaved });
    } catch (err) {
      console.error("Failed to check saved job:", err.message);
      res.status(500).json({ error: "Failed to check saved job. Please try again later." });
    }
  };
}
export const isJobSaved = createIsJobSavedHandler();

export function createUnsaveJobHandler(deps = {}) {
  const UserModel = deps.User || User;

  return async function unsaveJob(req, res) {
    try {
      const { jobId } = req.body;
      if (!isValidObjectId(jobId)) {
        return res.status(400).json({ error: "Invalid job ID." });
      }

      // Always caller's own saved jobs
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Idempotent; missing job is no-op
      user.savedJobs = user.savedJobs.filter((id) => id.toString() !== jobId);
      await user.save();

      res.json({ success: true, savedJobs: user.savedJobs });
    } catch (err) {
      console.error("Failed to unsave job:", err.message);
      res.status(500).json({ error: "Failed to unsave job. Please try again later." });
    }
  };
}
export const unsaveJob = createUnsaveJobHandler();
