import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String, required: true },

    // Not required; form omits it
    apply_link: { type: String },

    location: {
      raw: { type: String, required: true },
      display_name: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
    },

    tags: { type: [String], default: [] },
    normalized_skills: { type: [String], default: [] },

    salary: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      currency: { type: String, default: null },
      is_estimated: { type: Boolean, default: null },
    },

    job_type: { type: String, default: "unknown" },

    // Tri-state, never defaults false
    is_remote: { type: Boolean, default: null },

    experience_level: {
      type: String,
      enum: ["fresher", "entry", "junior", "mid", "senior", "unknown"],
      default: "unknown",
    },

    is_tech_relevant: { type: Boolean, default: null },
    tech_relevance_source: {
      type: String,
      enum: ["source_category", "keyword_heuristic", "manual", "unclassified"],
      default: "unclassified",
    },
    source_category: { type: String, default: null },

    // Set by language classifier
    language: { type: String, default: "en" },

    logo: { type: String, default: "" },

    date_posted: { type: Date, required: true, default: Date.now },
    last_seen_at: { type: Date, required: true, default: Date.now },
    expires_at: { type: Date, default: null },

    status: {
      type: String,
      enum: ["active", "expired", "filled", "removed"],
      default: "active",
      required: true,
    },

    // Separate from status lifecycle
    hiring_stage: { type: String },

    source: { type: String, required: true },

    // Not required; not yet populated
    source_id: { type: String },

    // Soft duplicate signal, unused
    dedup_fingerprint: { type: String },
  },
  { timestamps: true }
);

// Primary dedup key, partial
JobSchema.index(
  { source: 1, source_id: 1 },
  { unique: true, partialFilterExpression: { source_id: { $exists: true } } }
);

JobSchema.index({ status: 1, date_posted: -1 });
JobSchema.index({ "location.country": 1, is_tech_relevant: 1, experience_level: 1 });
JobSchema.index({ dedup_fingerprint: 1 });
JobSchema.index({ expires_at: 1 });
// Text index removed (language clash)

export default mongoose.model("Job", JobSchema);
