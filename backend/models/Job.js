import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String, required: true },

    // Not marked required: the existing manual "Add Job" form does not
    // currently submit this field, and routes/controllers are out of
    // scope for this phase. See JOB_SCHEMA_DESIGN.md §2-3 (marks it
    // "Required") and PHASE_1C1_REPORT.md for the reasoning.
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

    // Tri-state: true/false/unknown. Never defaults to false, since that
    // would falsely assert "confirmed on-site" when we simply don't know.
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

    // Pre-existing, unrelated concept (application/hiring-funnel stage),
    // deliberately kept separate from the `status` lifecycle field above.
    hiring_stage: { type: String },

    source: { type: String, required: true },

    // Not marked required: not yet populated by any existing code path
    // (manual creation doesn't set it; ingestion adapters aren't built
    // yet). See the partial unique index below.
    source_id: { type: String },

    // Derived soft duplicate signal; not yet computed by any code path.
    dedup_fingerprint: { type: String },
  },
  { timestamps: true }
);

// Primary dedup key. Partial so records without a source_id (e.g. manual
// entries, or any pre-migration data) never collide on uniqueness.
JobSchema.index(
  { source: 1, source_id: 1 },
  { unique: true, partialFilterExpression: { source_id: { $exists: true } } }
);

JobSchema.index({ status: 1, date_posted: -1 });
JobSchema.index({ "location.country": 1, is_tech_relevant: 1, experience_level: 1 });
JobSchema.index({ dedup_fingerprint: 1 });
JobSchema.index({ expires_at: 1 });
JobSchema.index({ title: "text", tags: "text", normalized_skills: "text" });

export default mongoose.model("Job", JobSchema);
