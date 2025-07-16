import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  type: String,
  description: String,
  postedAt: String,
  salary: String,
  skills: [String],
  applyLink: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Job || mongoose.model("Job", jobSchema);
