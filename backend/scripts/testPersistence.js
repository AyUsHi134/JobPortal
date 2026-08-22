// Deterministic + (best-effort) live verification for the Phase 1G
// persistence layer. Part A requires no MongoDB connection at all. Part B
// attempts a real connection using the existing backend/.env credentials
// (never modified, never printed) and ONLY runs live writes if that
// connection actually succeeds — if it fails, live tests are reported as
// skipped, never faked as passing. Any live test records created are
// tagged with a unique marker and cleaned up with a targeted deleteOne
// against that exact marker only — never deleteMany/drop.
//
// Run via: node backend/scripts/testPersistence.js

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Fail DB-dependent calls fast instead of buffering for the default 10s,
// since Part A deliberately exercises some paths with no connection yet.
mongoose.set("bufferTimeoutMS", 3000);

import Job from "../models/Job.js";
import { computeDedupFingerprint } from "../services/dedupFingerprint.js";
import { upsertClassifiedJob, buildUpsertSet, getJobById } from "../services/jobService.js";
import { persistJobs } from "../services/jobIngestionPipeline.js";

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

function adzunaJob(overrides = {}) {
  return {
    title: "Backend Developer (Node.js)",
    company: "Brightline Systems Pvt Ltd",
    description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
    apply_link: "https://www.adzuna.in/land/ad/5900001234?se=abc123",
    location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
    tags: [],
    normalized_skills: [],
    salary: { min: 800000, max: 1200000, currency: null, is_estimated: false },
    job_type: "full_time",
    is_remote: null,
    experience_level: "unknown",
    is_tech_relevant: true,
    tech_relevance_source: "source_category",
    source_category: "IT Jobs",
    logo: "",
    source: "adzuna",
    source_id: "5900001234",
    date_posted: new Date("2026-08-10T09:15:00Z"),
    ...overrides,
  };
}

function remoteOkJob(overrides = {}) {
  return {
    title: "Senior React Engineer",
    company: "Nimbus Cloud Labs",
    description: "We're hiring a remote Senior React Engineer to help build our dashboard product.",
    apply_link: "https://remoteok.com/remote-jobs/x",
    location: { raw: "Berlin, Germany", display_name: "Berlin, Germany", city: null, state: null, country: null },
    tags: ["react", "javascript", "frontend", "full time"],
    normalized_skills: ["javascript", "react"],
    salary: { min: 90000, max: 130000, currency: null, is_estimated: null },
    job_type: "unknown",
    is_remote: true,
    experience_level: "senior",
    is_tech_relevant: true,
    tech_relevance_source: "keyword_heuristic",
    source_category: null,
    logo: "",
    source: "remoteok",
    source_id: "1140002",
    date_posted: new Date("2026-08-14T12:49:18Z"),
    ...overrides,
  };
}

console.log("============================");
console.log(" PART A: STATIC / DETERMINISTIC (no MongoDB connection required)");
console.log("============================");

console.log("\n[A1] Fingerprint determinism");
const fpA = computeDedupFingerprint(adzunaJob());
const fpA2 = computeDedupFingerprint(adzunaJob());
check("same job -> same fingerprint", fpA === fpA2);
check("fingerprint is a non-empty string", typeof fpA === "string" && fpA.length > 0);

console.log("\n[A2] Fingerprint sensitivity to title/company/location");
const fpDiffTitle = computeDedupFingerprint(adzunaJob({ title: "Totally Different Title" }));
const fpDiffCompany = computeDedupFingerprint(adzunaJob({ company: "Some Other Company" }));
const fpDiffLocation = computeDedupFingerprint(
  adzunaJob({ location: { raw: "Chennai, Tamil Nadu", city: "Chennai" } })
);
check("different title -> different fingerprint", fpDiffTitle !== fpA);
check("different company -> different fingerprint", fpDiffCompany !== fpA);
check("different location -> different fingerprint", fpDiffLocation !== fpA);

console.log("\n[A3] Fingerprint normalization (case/whitespace-insensitive)");
const fpMessy = computeDedupFingerprint(
  adzunaJob({ title: "  Backend   Developer (Node.js)  ", company: "BRIGHTLINE systems pvt ltd" })
);
check("case/whitespace differences produce the SAME fingerprint", fpMessy === fpA);

console.log("\n[A4] Cross-source fingerprint collision (same role posted to both sources)");
const sameRoleOnRemoteOk = remoteOkJob({
  title: "Backend Developer (Node.js)",
  company: "Brightline Systems Pvt Ltd",
  location: { raw: "Pune, Maharashtra", city: "Pune" },
});
const fpCrossSource = computeDedupFingerprint(sameRoleOnRemoteOk);
check("identical title/company/city across sources -> identical fingerprint", fpCrossSource === fpA);

console.log("\n[A5] Fingerprint handles missing fields safely");
let a5Threw = false;
let fpEmpty;
try {
  fpEmpty = computeDedupFingerprint({});
  computeDedupFingerprint(null);
  computeDedupFingerprint({ title: "Only Title" });
} catch (e) {
  a5Threw = true;
}
check("no crash on missing/null input", !a5Threw);
check("empty job still produces a string fingerprint", typeof fpEmpty === "string" && fpEmpty.length > 0);

console.log("\n[A6] Pre-flight identity validation (missing source/source_id) — must not touch the DB");
const startA6 = Date.now();
const missingSource = await upsertClassifiedJob({ ...adzunaJob(), source: undefined });
const missingSourceId = await upsertClassifiedJob({ ...adzunaJob(), source_id: "" });
const elapsedA6 = Date.now() - startA6;
check("missing source -> status skipped_invalid", missingSource.status === "skipped_invalid");
check("empty source_id -> status skipped_invalid", missingSourceId.status === "skipped_invalid");
check("resolved quickly (<1s), proving no DB call was attempted", elapsedA6 < 1000);
check("reason message present", typeof missingSource.reason === "string" && missingSource.reason.length > 0);

console.log("\n[A7] buildUpsertSet excludes lifecycle/internal fields even if present on input");
const poisoned = {
  ...adzunaJob(),
  _id: "should-never-be-copied",
  status: "expired", // simulates accidentally re-feeding an already-persisted doc
  expires_at: new Date("2020-01-01"),
  hiring_stage: "interviewing",
  createdAt: new Date("2000-01-01"),
  updatedAt: new Date("2000-01-01"),
};
const built = buildUpsertSet(poisoned);
check("status is NOT included in the upsert $set", !("status" in built));
check("expires_at is NOT included in the upsert $set", !("expires_at" in built));
check("hiring_stage is NOT included in the upsert $set", !("hiring_stage" in built));
check("_id is NOT included in the upsert $set", !("_id" in built));
check("createdAt/updatedAt are NOT included in the upsert $set", !("createdAt" in built) && !("updatedAt" in built));
check("title IS included", built.title === poisoned.title);
check("company IS included", built.company === poisoned.company);

console.log("\n[A8] buildUpsertSet omits date_posted when absent (lets schema default apply on insert)");
const noDateJob = adzunaJob();
delete noDateJob.date_posted;
const builtNoDate = buildUpsertSet(noDateJob);
check("date_posted key absent when job has no date_posted", !("date_posted" in builtNoDate));
const withDateJob = adzunaJob();
const builtWithDate = buildUpsertSet(withDateJob);
check("date_posted key present when job has a real date_posted", builtWithDate.date_posted instanceof Date);

console.log("\n[A9] In-memory Mongoose schema validation of what would actually be persisted");
for (const [label, fixture] of [
  ["Adzuna job", adzunaJob()],
  ["RemoteOK job", remoteOkJob()],
]) {
  const set = buildUpsertSet(fixture);
  set.source = fixture.source;
  set.source_id = fixture.source_id;
  set.dedup_fingerprint = computeDedupFingerprint(fixture);
  set.last_seen_at = new Date();
  const doc = new Job(set);
  try {
    await doc.validate();
    check(`${label}: Mongoose validate() passes for the exact $set that would be written`, true);
  } catch (err) {
    check(`${label}: Mongoose validate() passes (FAILED: ${err.message})`, false);
  }
}

console.log("\n[A10] Batch pipeline: one DB-dependent failure does not stop the rest of the batch");
console.log("      (no live connection is open yet, so the valid job below is expected to fail fast");
console.log("      via bufferTimeoutMS — this is itself a valid resilience check.)");
const batchResult = await persistJobs([
  adzunaJob({ source_id: "BATCH-TEST-1" }), // will fail: no DB connection yet
  { ...adzunaJob({ source_id: "BATCH-TEST-2" }), source_id: "" }, // pre-flight skip, no DB needed
  remoteOkJob({ source_id: "BATCH-TEST-3" }), // will also fail: no DB connection yet
]);
check("persistJobs did not throw for the whole batch", true); // reaching this line proves it
check("summary.total === 3", batchResult.summary.total === 3);
check("summary.skipped_invalid === 1", batchResult.summary.skipped_invalid === 1);
check(
  "the two DB-dependent jobs were reported as errors, not silently dropped",
  batchResult.results.filter((r) => r.status === "error").length === 2
);
console.log("  (batch summary: " + JSON.stringify(batchResult.summary) + ")");

console.log("\n============================");
console.log(" PART B: LIVE MONGODB TEST (best-effort — only runs writes if connection succeeds)");
console.log("============================");

let liveConnected = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  liveConnected = true;
  console.log("Live MongoDB connection: SUCCESS");
} catch (err) {
  console.log("Live MongoDB connection: FAILED");
  console.log(`  Error: ${err.name}: ${err.message}`);
  console.log("  No credentials were changed. No live writes were attempted.");
}

if (!liveConnected) {
  console.log("\nLive persistence tests SKIPPED (connection unavailable). This is not counted as a pass or fail.");
} else {
  const TEST_MARKER = `phase1g-test-${Date.now()}`;
  const createdIds = [];
  try {
    console.log(`\nUsing test marker: ${TEST_MARKER} (source_id will be prefixed with this)`);

    console.log("\n[B1] First ingestion inserts a new job");
    const testJob = adzunaJob({ source_id: `${TEST_MARKER}-1`, title: "PHASE1G TEST Backend Developer" });
    const insertResult = await upsertClassifiedJob(testJob);
    createdIds.push(insertResult.jobId);
    check("status === inserted", insertResult.status === "inserted");

    console.log("\n[B2] Re-ingesting the identical job updates rather than duplicates");
    const beforeCount = await Job.countDocuments({ source: "adzuna", source_id: `${TEST_MARKER}-1` });
    const updateResult = await upsertClassifiedJob(testJob);
    const afterCount = await Job.countDocuments({ source: "adzuna", source_id: `${TEST_MARKER}-1` });
    check("status === updated on re-ingestion", updateResult.status === "updated");
    check("still exactly one document for this source_id", beforeCount === 1 && afterCount === 1);
    check("same jobId returned both times (idempotent)", String(insertResult.jobId) === String(updateResult.jobId));

    console.log("\n[B3] last_seen_at changes on re-observation");
    const docAfterFirst = await getJobById(insertResult.jobId);
    const firstSeenAt = docAfterFirst.last_seen_at.getTime();
    await new Promise((r) => setTimeout(r, 50));
    await upsertClassifiedJob(testJob);
    const docAfterSecond = await getJobById(insertResult.jobId);
    check("last_seen_at advanced on re-ingestion", docAfterSecond.last_seen_at.getTime() > firstSeenAt);

    console.log("\n[B4] Lifecycle fields protected by $setOnInsert survive re-ingestion");
    await Job.updateOne({ _id: insertResult.jobId }, { $set: { status: "expired" } });
    const reIngestResult = await upsertClassifiedJob(testJob);
    const docAfterExpireReingest = await getJobById(insertResult.jobId);
    check("status remains 'expired' after re-ingestion (not silently reset to active)", docAfterExpireReingest.status === "expired");
    check("re-ingestion still reports status === updated", reIngestResult.status === "updated");

    console.log("\n[B5] Cross-source fingerprint collision produces a warning, not a merge/delete");
    const collidingJob = remoteOkJob({
      source_id: `${TEST_MARKER}-2`,
      title: testJob.title,
      company: testJob.company,
      location: { raw: testJob.location.raw, city: testJob.location.city },
    });
    const collisionResult = await upsertClassifiedJob(collidingJob);
    createdIds.push(collisionResult.jobId);
    check("colliding job was still inserted (never discarded)", collisionResult.status === "inserted");
    check(
      "crossSourceDuplicates reports the original adzuna record",
      collisionResult.crossSourceDuplicates.some((d) => String(d._id) === String(insertResult.jobId))
    );
    const bothStillExist = await Job.countDocuments({ source_id: { $in: [`${TEST_MARKER}-1`, `${TEST_MARKER}-2`] } });
    check("both records still exist independently (no auto-merge/delete)", bothStillExist === 2);

    console.log("\n[B6] Missing/invalid source identity handled safely (live context)");
    const invalidLive = await upsertClassifiedJob({ ...adzunaJob(), source_id: undefined });
    check("skipped_invalid, no document created", invalidLive.status === "skipped_invalid");

    console.log("\n[B7] Malformed normalized job does not crash the batch (live context)");
    const malformedBatch = await persistJobs([
      adzunaJob({ source_id: `${TEST_MARKER}-3`, title: "PHASE1G TEST Full Stack Developer" }),
      { source: "adzuna", source_id: `${TEST_MARKER}-4` }, // missing title/company/description/location -> Mongoose validation error
      remoteOkJob({ source_id: `${TEST_MARKER}-5`, title: "PHASE1G TEST QA Engineer" }),
    ]);
    for (const r of malformedBatch.results) {
      if (r.status === "inserted" && r.jobId) createdIds.push(r.jobId);
    }
    check("batch of 3 fully processed without throwing", malformedBatch.summary.total === 3);
    check("2 valid jobs inserted", malformedBatch.summary.inserted === 2);
    check("1 malformed job reported as error (not silently dropped, not crashing)", malformedBatch.summary.errors === 1);
  } finally {
    console.log(`\nCleaning up ${createdIds.length} test record(s) created by this run (targeted deleteOne only)...`);
    for (const id of createdIds) {
      if (!id) continue;
      await Job.deleteOne({ _id: id });
    }
    console.log("Cleanup complete. No unrelated data was touched.");
    await mongoose.disconnect();
  }
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed (Part A + B live tests, where run)`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
