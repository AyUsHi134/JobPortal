import express from "express";
import User from "../models/user.js";
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

export default router;
