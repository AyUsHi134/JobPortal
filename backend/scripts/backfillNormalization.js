// One-off backfill: re-applies the SAME text-cleanup and title-rejection
// logic the live ingestion normalizers already use (decodeHtmlEntities,
// repairMojibake, isPlaceholderOrGarbledTitle — all imported from
// integrations/jobs/normalizationHelpers.js, none reimplemented here) to
// every EXISTING Job document, not just newly-(re-)ingested ones.
//
// Why this exists: normalization only ever runs at ingestion time. A
// record inserted before a normalization fix existed, or a manually
// created job (source: "manual", which never runs through the normalizer
// at all), keeps its original, uncleaned text forever unless the exact
// same {source, source_id} happens to be re-fetched by a later scheduled
// run. This script is the one-time catch-up pass for everything already
// sitting in MongoDB. This is a plain script, not a route/service — it is
// never imported or run automatically by the application.
//
// What it does, per document:
//   - Cleans title/company/description/location.{raw,display_name,city,
//     state,country} through decodeHtmlEntities(repairMojibake(value)) —
//     the exact same order the normalizers already apply. Both helpers
//     pass a non-string (including null) straight through unchanged, so
//     this is safe on every field, including the location subfields that
//     are frequently null.
//   - Computes `language` via classifyLanguage (same function classifyJob
//     already calls during ingestion), against the CLEANED title/
//     description — mirroring production's normalize-then-classify order.
//     Only written if it differs from what the document already has.
//   - Re-checks the CLEANED title with isPlaceholderOrGarbledTitle. If it
//     now fails (a placeholder/garbled/likely-non-English title), the job
//     is suppressed by setting status: "removed" — reusing the existing
//     Job.status enum, not a new field. The document's other text fields
//     are left exactly as they were (this is a soft, reversible
//     suppression, not a delete/rewrite of a record being suppressed
//     anyway) — `language` is still corrected in this same branch, since
//     it's an independent, orthogonal tag, not a "text field."
//   - Otherwise, only the fields that actually changed (text fields and/or
//     language) are written via a targeted $set — a document that's
//     already fully clean and correctly tagged produces no write at all.
//
// jobService.searchJobs (via buildJobFilter) and jobService.getActiveJobById
// already filter to status: "active" (confirmed by reading
// backend/services/jobService.js, and re-asserted at runtime below before
// any write happens), so a job flagged "removed" here is immediately
// excluded from both the public listing and detail endpoints with no
// further code change required.
//
// Safety: read-then-targeted-write only, one Job.updateOne({_id}, {$set})
// per document that actually needs a change — no deleteMany, no
// dropCollection, no unconditional bulk write. One document's write/
// validation error is caught and counted, never aborting the rest of the
// run. Uses the same backend/.env MONGO_URI every other
// backend/scripts/*.js file uses.
//
// Run via: node backend/scripts/backfillNormalization.js

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import Job from "../models/Job.js";
import * as jobService from "../services/jobService.js";
import {
  decodeHtmlEntities,
  repairMojibake,
  isPlaceholderOrGarbledTitle,
} from "../integrations/jobs/normalizationHelpers.js";
import { classifyLanguage } from "../integrations/jobs/languageClassifier.js";

const LOCATION_TEXT_FIELDS = ["raw", "display_name", "city", "state", "country"];

function clean(value) {
  return decodeHtmlEntities(repairMojibake(value));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB.\n");

  // Confirms, against the real current jobService (not from memory), the
  // read-path guarantee this script's whole "removed is enough to hide a
  // job" approach depends on. Aborts before writing anything if it no
  // longer holds, rather than silently relying on a stale assumption.
  const defaultFilter = jobService.buildJobFilter({});
  if (defaultFilter.status !== "active") {
    throw new Error(
      "jobService.buildJobFilter no longer defaults to status:'active' — searchJobs would no longer exclude " +
        "'removed' jobs. Aborting before making any change."
    );
  }
  console.log("Verified: jobService.searchJobs (via buildJobFilter) filters to status:'active'. OK.");
  console.log(
    "Verified (by source, backend/services/jobService.js:getActiveJobById): GET /api/jobs/:id also queries " +
      "{status:'active'} directly. OK.\n"
  );

  let totalChecked = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalErrors = 0;
  let totalLanguageOther = 0;

  const cursor = Job.find({}).lean().cursor();
  for await (const doc of cursor) {
    totalChecked++;

    try {
      const cleanedTitle = clean(doc.title);
      const cleanedCompany = clean(doc.company);
      const cleanedDescription = clean(doc.description);
      const location = doc.location || {};
      const cleanedLocation = {};
      for (const field of LOCATION_TEXT_FIELDS) {
        cleanedLocation[field] = clean(location[field]);
      }

      const computedLanguage = classifyLanguage({ title: cleanedTitle, description: cleanedDescription });
      if (computedLanguage === "other") totalLanguageOther++;

      if (isPlaceholderOrGarbledTitle(cleanedTitle)) {
        const removedSet = {};
        if (doc.status !== "removed") removedSet.status = "removed";
        if (doc.language !== computedLanguage) removedSet.language = computedLanguage;
        if (Object.keys(removedSet).length > 0) {
          await Job.updateOne({ _id: doc._id }, { $set: removedSet }, { runValidators: true });
        }
        totalRemoved++;
        continue;
      }

      const set = {};
      if (cleanedTitle !== doc.title) set.title = cleanedTitle;
      if (cleanedCompany !== doc.company) set.company = cleanedCompany;
      if (cleanedDescription !== doc.description) set.description = cleanedDescription;
      for (const field of LOCATION_TEXT_FIELDS) {
        if (cleanedLocation[field] !== location[field]) set[`location.${field}`] = cleanedLocation[field];
      }
      if (doc.language !== computedLanguage) set.language = computedLanguage;

      if (Object.keys(set).length > 0) {
        await Job.updateOne({ _id: doc._id }, { $set: set }, { runValidators: true });
        totalUpdated++;
      }
    } catch (err) {
      totalErrors++;
      console.error(`Failed to backfill job ${doc._id}: ${err.message}`);
    }
  }

  console.log("============================");
  console.log(" BACKFILL SUMMARY");
  console.log("============================");
  console.log(`Total checked:         ${totalChecked}`);
  console.log(`Total updated:         ${totalUpdated}`);
  console.log(`Total flagged removed: ${totalRemoved}`);
  console.log(`Total language:"other": ${totalLanguageOther}`);
  if (totalErrors > 0) {
    console.log(`Total errors:          ${totalErrors} (see messages above — these documents were left untouched)`);
  }

  await mongoose.disconnect();
  if (totalErrors > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error("FATAL ERROR during normalization backfill:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // already disconnected or never connected — nothing further to do
  }
  process.exitCode = 1;
});
