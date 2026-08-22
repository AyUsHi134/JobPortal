import mongoose from "mongoose";
import User from "../models/User.js";

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

// Strips the password hash from a Mongoose document before it's ever
// sent in a response. `updateProfile` previously sent the raw document
// straight back (`res.json(user)`), which included the bcrypt hash.
function sanitizeUser(userDoc) {
  const obj = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  return obj;
}

/**
 * All four handlers below follow the same `deps`-injection factory
 * pattern already established in controllers/jobs.js, so
 * backend/scripts/testAuthorization.js / testSaveJobs.js can exercise
 * them deterministically (a mocked User model, no MongoDB connection,
 * no real user data touched) while production continues to use the
 * default-configured exports unchanged. Every one of these routes runs
 * behind `authMiddleware` (routes/user.js) — `req.user.id` is always the
 * verified JWT subject, never a client-suppliable id.
 */
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
      // Always the authenticated caller's own document — a user can
      // never modify another user's profile by supplying a different id
      // in the request body; there is no id in the request this reads.
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (name) user.name = name;
      if (email) user.email = email;
      await user.save();

      res.json(sanitizeUser(user));
    } catch (err) {
      // User.email has a unique index — a duplicate produces a Mongo
      // E11000 error, which previously would have been an uncaught
      // rejection (no try/catch existed at all). Reported as a clean 400
      // rather than a raw driver error leaking to the client.
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

      // Previously took `userId` straight from req.body — any
      // authenticated (or even unauthenticated, since this route wasn't
      // behind authMiddleware at all) caller could save a job onto ANY
      // other user's account by supplying their id. The owner is now
      // always req.user.id, the verified JWT subject.
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // .includes() on a MongooseArray of ObjectIds vs. a plain jobId
      // string never matches by value (reference/strict equality only),
      // so the old dedup check silently never worked — fixed alongside
      // the authorization change since this line had to be rewritten
      // anyway. See PHASE_1I4_REPORT.md §5.
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

      // Same fix as saveJob: always the authenticated caller's own
      // saved-jobs list, never an arbitrary `userId` from the request.
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
