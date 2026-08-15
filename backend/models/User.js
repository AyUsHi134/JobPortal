import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }]
});

export default mongoose.models.User || mongoose.model("User", userSchema);
