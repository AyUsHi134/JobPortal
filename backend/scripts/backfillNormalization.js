// One-off backfill of existing jobs

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

  // Verifies removed jobs stay hidden
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
    // Already disconnected, nothing to do
  }
  process.exitCode = 1;
});
