// Phase 1H-4 — controlled LIVE end-to-end ingestion verification.
//
// Unlike every other test*.js script in this directory, this one is NOT
// deterministic and DOES make real live calls: one real Adzuna API call,
// one real RemoteOK API call (both made exactly once, through the
// existing production orchestrator — backend/services/ingestionOrchestrator.js
// — never bypassed for the main run), and real reads/writes against the
// live MongoDB Atlas `jobportal` database using the existing, unmodified
// Phase 1G persistence path.
//
// Safety discipline:
//   - The MAIN run uses the orchestrator's real default registry (no
//     mocked fetch) exactly once per source — never called in a loop,
//     never retried beyond the existing bounded Phase 1H-3 retry policy.
//   - Every job the main run inserts/updates is real, legitimate
//     JobPortal data and is NEVER deleted by this script.
//   - Only clearly-marked synthetic records (source_id prefixed
//     `phase1h4-<subtest>-<timestamp>`) created for the fingerprint-
//     collision check are deleted, via targeted deleteOne({_id}) calls,
//     immediately after that specific check. No deleteMany/drop is used
//     anywhere in this file.
//   - The malformed-job check stubs only the network fetch step (no live
//     call) while still exercising the real normalizer/classifier/
//     persistence path against the real DB.
//   - The scheduler (backend/services/ingestionScheduler.js) is never
//     imported/started here — the orchestrator is invoked directly,
//     exactly once, deliberately avoiding any risk of a second real
//     ingestion run or waiting on a real cron interval.
//
// Run via: node backend/scripts/testLiveIngestion.js

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import Job from "../models/Job.js";
import { runAllSourcesIngestion, runSourceIngestion } from "../services/ingestionOrchestrator.js";
import { upsertClassifiedJob, getJobById } from "../services/jobService.js";
import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}

function truncate(str, n) {
  if (typeof str !== "string") return str;
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function sanitizedSampleView(d) {
  return {
    _id: String(d._id),
    source: d.source,
    source_id: d.source_id,
    title: d.title,
    company: d.company,
    location: d.location,
    salary: d.salary,
    job_type: d.job_type,
    is_remote: d.is_remote,
    status: d.status,
    last_seen_at: d.last_seen_at,
    expires_at: d.expires_at,
    dedup_fingerprint: d.dedup_fingerprint,
    is_tech_relevant: d.is_tech_relevant,
    tech_relevance_source: d.tech_relevance_source,
    experience_level: d.experience_level,
    normalized_skills: d.normalized_skills,
    tags: d.tags,
    description_preview: truncate(d.description, 90),
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB (jobportal).\n");

  const initialCount = await Job.countDocuments({});
  console.log(`Initial total job count: ${initialCount}`);

  console.log("\n============================");
  console.log(" MAIN LIVE RUN — runAllSourcesIngestion() via the real production registry (no mocks)");
  console.log("============================");
  const runStartedAt = new Date();
  const mainResult = await runAllSourcesIngestion({ adzuna: { what: "software developer" } });
  console.log(JSON.stringify(mainResult, null, 2));

  const finalCount = await Job.countDocuments({});
  console.log(`\nFinal total job count after main run: ${finalCount} (delta: ${finalCount - initialCount})`);
  check(
    "DB count delta matches the run's reported insertedCount (updates never change the total count)",
    finalCount - initialCount === mainResult.totals.insertedCount
  );

  // --- Sample real persisted docs per source that actually succeeded ---
  const samples = {};
  for (const s of mainResult.sources) {
    if (!s.fetchOk) continue;
    const docs = await Job.find({ source: s.source, updatedAt: { $gte: runStartedAt } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean();
    samples[s.source] = docs;
    console.log(`\n--- Sample of ${docs.length} ${s.source} document(s) touched by this run ---`);
    for (const d of docs) console.log(sanitizedSampleView(d));
  }

  console.log("\n============================");
  console.log(" SAMPLE FIELD VALIDATION (structure expected by backend/models/Job.js)");
  console.log("============================");
  for (const [source, docs] of Object.entries(samples)) {
    for (const d of docs) {
      const label = `${source}/${d.source_id}`;
      check(`${label}: has source+source_id`, Boolean(d.source && d.source_id));
      check(`${label}: has structured location.raw`, Boolean(d.location && d.location.raw));
      check(
        `${label}: salary is a structured object (min/max/currency/is_estimated)`,
        Boolean(d.salary) && "min" in d.salary && "max" in d.salary && "currency" in d.salary && "is_estimated" in d.salary
      );
      check(`${label}: is_remote is tri-state (true/false/null)`, d.is_remote === true || d.is_remote === false || d.is_remote === null);
      check(`${label}: has lifecycle fields (status + last_seen_at)`, Boolean(d.status) && Boolean(d.last_seen_at));
      check(`${label}: has dedup_fingerprint`, typeof d.dedup_fingerprint === "string" && d.dedup_fingerprint.length > 0);
      check(`${label}: has experience_level`, typeof d.experience_level === "string");
      check(`${label}: has normalized_skills array`, Array.isArray(d.normalized_skills));
      check(`${label}: has is_tech_relevant + tech_relevance_source`, "is_tech_relevant" in d && typeof d.tech_relevance_source === "string");
    }
  }

  if (samples.adzuna && samples.adzuna.length > 0) {
    const indiaCount = samples.adzuna.filter((d) => d.location && d.location.country === "India").length;
    console.log(`\nAdzuna sample: ${indiaCount}/${samples.adzuna.length} sampled job(s) have location.country === "India" (reported honestly, not assumed).`);
  }
  if (samples.remoteok && samples.remoteok.length > 0) {
    check("remoteok sample: is_remote is true for every sampled job (source semantics preserved)", samples.remoteok.every((d) => d.is_remote === true));
    check("remoteok sample: source identity preserved (source === 'remoteok' for all)", samples.remoteok.every((d) => d.source === "remoteok"));
  }

  // --- Honest classification distribution across everything this run touched (not just the small sample) ---
  console.log("\n============================");
  console.log(" CLASSIFICATION DISTRIBUTION — ALL docs touched by this run (honest counts, not fabricated)");
  console.log("============================");
  const touchedSources = mainResult.sources.filter((s) => s.fetchOk).map((s) => s.source);
  if (touchedSources.length > 0) {
    const touchedFilter = { updatedAt: { $gte: runStartedAt }, source: { $in: touchedSources } };
    const expLevels = await Job.aggregate([{ $match: touchedFilter }, { $group: { _id: "$experience_level", count: { $sum: 1 } } }]);
    const techRelevant = await Job.aggregate([{ $match: touchedFilter }, { $group: { _id: "$is_tech_relevant", count: { $sum: 1 } } }]);
    console.log("experience_level distribution:", JSON.stringify(expLevels));
    console.log("is_tech_relevant distribution:", JSON.stringify(techRelevant));
  } else {
    console.log("No source succeeded in this run — nothing to distribute over. Not fabricating a distribution.");
  }

  // --- Idempotency check on ONE real ingested job ---
  console.log("\n============================");
  console.log(" IDEMPOTENCY CHECK — replay one real ingested job through the existing persistence path");
  console.log("============================");
  const pickSource = samples.adzuna?.length > 0 ? "adzuna" : samples.remoteok?.length > 0 ? "remoteok" : null;
  if (!pickSource) {
    console.log("No successfully-ingested real job is available to test idempotency against — skipping honestly, not fabricating a result.");
  } else {
    const original = samples[pickSource][0];
    const beforeCount = await Job.countDocuments({ source: original.source, source_id: original.source_id });
    const beforeLastSeenMs = new Date(original.last_seen_at).getTime();
    const beforeId = String(original._id);

    // Reconstructs the exact classified-job shape jobService.upsertClassifiedJob
    // expects, from the REAL persisted document's own current field values —
    // this is "the existing persistence path", replayed with the identical
    // {source, source_id} identity, with no second live API call required.
    const replay = {
      title: original.title,
      company: original.company,
      description: original.description,
      apply_link: original.apply_link,
      location: original.location,
      tags: original.tags,
      normalized_skills: original.normalized_skills,
      salary: original.salary,
      job_type: original.job_type,
      is_remote: original.is_remote,
      experience_level: original.experience_level,
      is_tech_relevant: original.is_tech_relevant,
      tech_relevance_source: original.tech_relevance_source,
      source_category: original.source_category,
      logo: original.logo,
      source: original.source,
      source_id: original.source_id,
    };

    await new Promise((r) => setTimeout(r, 50)); // ensure a measurable last_seen_at delta
    const replayResult = await upsertClassifiedJob(replay);
    const afterCount = await Job.countDocuments({ source: original.source, source_id: original.source_id });
    const afterDoc = await getJobById(replayResult.jobId);

    check("replay reports status 'updated', not 'inserted'", replayResult.status === "updated");
    check("same document _id before and after (no duplicate created)", String(replayResult.jobId) === beforeId);
    check("still exactly one document for this {source, source_id}", beforeCount === 1 && afterCount === 1);
    check("last_seen_at advanced on replay", afterDoc.last_seen_at.getTime() > beforeLastSeenMs);
  }

  // --- Cross-source fingerprint collision check (controlled synthetic pair, fully cleaned up) ---
  console.log("\n============================");
  console.log(" CROSS-SOURCE FINGERPRINT COLLISION CHECK — controlled synthetic pair, cleaned up immediately after");
  console.log("============================");
  const fpMarker = `phase1h4-fingerprint-${Date.now()}`;
  const fpCreatedIds = [];
  try {
    const jobA = {
      title: "PHASE1H4 TEST Backend Developer",
      company: "PHASE1H4 TEST Company",
      description: "Synthetic test record for cross-source fingerprint verification only. Not a real job posting.",
      location: { raw: "Test City", city: "Test City", state: null, country: null },
      tags: [],
      normalized_skills: [],
      salary: { min: null, max: null, currency: null, is_estimated: null },
      job_type: "unknown",
      is_remote: null,
      experience_level: "unknown",
      is_tech_relevant: null,
      tech_relevance_source: "unclassified",
      source_category: null,
      logo: "",
      source: "adzuna",
      source_id: `${fpMarker}-a`,
    };
    const jobB = { ...jobA, source: "remoteok", source_id: `${fpMarker}-b` };

    const resultA = await upsertClassifiedJob(jobA);
    fpCreatedIds.push(resultA.jobId);
    const resultB = await upsertClassifiedJob(jobB);
    fpCreatedIds.push(resultB.jobId);

    check("the second synthetic job (different source, identical title/company/location) reports a cross-source duplicate warning", resultB.crossSourceDuplicates.length > 0);
    check("the warning references the first synthetic job's real _id", resultB.crossSourceDuplicates.some((d) => String(d._id) === String(resultA.jobId)));
    const bothExist = await Job.countDocuments({ source_id: { $in: [`${fpMarker}-a`, `${fpMarker}-b`] } });
    check("both synthetic records still exist independently — no auto-merge/delete occurred", bothExist === 2);
  } finally {
    for (const id of fpCreatedIds) {
      if (id) await Job.deleteOne({ _id: id });
    }
    const leftover = await Job.countDocuments({ source_id: { $regex: `^${fpMarker}` } });
    check("fingerprint-collision synthetic test records were fully cleaned up (targeted deleteOne only)", leftover === 0);
  }

  // --- Malformed-job rejection check, through the orchestrator, fetch stubbed (no live API call) ---
  console.log("\n============================");
  console.log(" MALFORMED-JOB REJECTION CHECK — through the orchestrator; fetch stubbed (no extra live API call); real normalize+classify+persist");
  console.log("============================");
  const beforeMalformedCount = await Job.countDocuments({});
  const malformedRegistry = {
    adzuna: {
      fetch: async () => ({
        ok: true,
        source: "adzuna",
        jobs: [{ description: "malformed synthetic test job — deliberately missing title/company/id/location" }],
        meta: { mocked: true, note: "stubbed fetch — no live Adzuna call made for this check" },
        error: null,
        fetchedAt: new Date(),
      }),
      normalize: normalizeAdzunaJob,
    },
  };
  const malformedResult = await runSourceIngestion("adzuna", {}, { registry: malformedRegistry });
  const afterMalformedCount = await Job.countDocuments({});

  check("the malformed raw job is rejected at normalization (rejectedCount === 1)", malformedResult.rejectedCount === 1);
  check("nothing from it reaches persistence (normalizedCount === 0)", malformedResult.normalizedCount === 0);
  check("no document was created for the malformed job (DB total count unchanged)", afterMalformedCount === beforeMalformedCount);

  // --- Final reconciliation ---
  console.log("\n============================");
  console.log(" FINAL RECONCILIATION");
  console.log("============================");
  const veryFinalCount = await Job.countDocuments({});
  console.log(`Job count — initial: ${initialCount}, after main run: ${finalCount}, final: ${veryFinalCount}`);
  check("no net change from the temporary verification sub-tests (only the main run's legitimate inserts remain)", veryFinalCount === finalCount);
  const anyLeftoverTestDocs = await Job.countDocuments({ source_id: { $regex: /^phase1h4-/ } });
  check("zero leftover phase1h4-* synthetic test documents remain anywhere in the collection", anyLeftoverTestDocs === 0);

  console.log("\n============================");
  console.log(` RESULT: ${passCount} passed, ${failCount} failed (live verification checks)`);
  console.log("============================");

  await mongoose.disconnect();
  if (failCount > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error("FATAL ERROR during live verification:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // already disconnected or never connected — nothing further to do
  }
  process.exitCode = 1;
});
