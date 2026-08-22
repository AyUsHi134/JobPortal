// Deterministic + static verification for the Phase 2E Saved Jobs
// feature: utils/savedJobsLoader.js#loadSavedJobs (the pure fetch-each-
// id-individually orchestration, since BACKEND_API_CONTRACT.md §6/§7 has
// no bulk "list my saved jobs" endpoint) and pages/SavedJobs/SavedJobs.jsx
// itself (never requests another user's saved jobs, reuses JobCard
// rather than duplicating its rendering, no direct fetch/axios, route is
// actually registered). Run via `node src/tests/testSavedJobsPage.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

const { loadSavedJobs } = await import("../utils/savedJobsLoader.js");

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

function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

console.log("============================");
console.log(" SAVED JOBS PAGE — DETERMINISTIC + STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] loadSavedJobs — an empty/missing id list resolves to an empty page without ever calling the fetcher");
{
  let callCount = 0;
  const fetchJob = async () => { callCount++; return {}; };

  const emptyResult = await loadSavedJobs([], fetchJob);
  check("empty array -> {jobs: [], unavailableCount: 0}", emptyResult.jobs.length === 0 && emptyResult.unavailableCount === 0);

  const missingResult = await loadSavedJobs(undefined, fetchJob);
  check("missing/undefined -> the same safe empty shape, never throws", missingResult.jobs.length === 0 && missingResult.unavailableCount === 0);

  check("the fetcher was never called for an empty list — no pointless requests", callCount === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[2] loadSavedJobs — requests each id individually and returns the resolved jobs in order");
{
  const requested = [];
  const jobsById = {
    "job-1": { _id: "job-1", title: "Backend Developer" },
    "job-2": { _id: "job-2", title: "Frontend Developer" },
  };
  const fetchJob = async (id) => {
    requested.push(id);
    return jobsById[id];
  };

  const { jobs, unavailableCount } = await loadSavedJobs(["job-1", "job-2"], fetchJob);

  check("both ids were individually requested (no bulk endpoint exists to use instead)", requested.length === 2 && requested.includes("job-1") && requested.includes("job-2"));
  check("both jobs resolved", jobs.length === 2);
  check("no unavailable jobs when every fetch succeeds", unavailableCount === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[3] loadSavedJobs — a saved job that later 404s (expired/removed) is dropped, not fabricated, and counted honestly");
{
  const fetchJob = async (id) => {
    if (id === "gone") {
      const err = new Error("Job not found.");
      err.status = 404;
      throw err;
    }
    return { _id: id, title: "Still Active" };
  };

  const { jobs, unavailableCount } = await loadSavedJobs(["still-here", "gone"], fetchJob);

  check("the still-active job is returned", jobs.length === 1 && jobs[0]._id === "still-here");
  check("no fabricated placeholder is returned for the 404'd job", !jobs.some((j) => j._id === "gone"));
  check("the unavailable count reflects the real failure, so it isn't silently hidden", unavailableCount === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[4] loadSavedJobs — every job failing to resolve still returns a safe, empty-jobs result (never throws/crashes the page)");
{
  const fetchJob = async () => {
    throw new Error("Job not found.");
  };
  const { jobs, unavailableCount } = await loadSavedJobs(["a", "b"], fetchJob);
  check("jobs is empty", jobs.length === 0);
  check("unavailableCount reflects both failures", unavailableCount === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[5] SavedJobs.jsx — sources data exclusively through the centralized service layer, never another user's id");
{
  const source = readSource("pages/SavedJobs/SavedJobs.jsx");
  check("imports getProfile from services/userApi.js (the authenticated caller's own profile — no user id parameter exists to misuse)", /getProfile/.test(source) && /from ["'].*services\/userApi\.js["']/.test(source));
  check("imports loadSavedJobs from utils/savedJobsLoader.js (reuses jobsApi.getJobById under the hood, not a duplicated fetch)", /loadSavedJobs/.test(source) && /from ["'].*utils\/savedJobsLoader\.js["']/.test(source));
  check("contains no direct fetch(...) call", !/\bfetch\(/.test(source));
  check("contains no direct axios usage", !/\baxios\b/.test(source));
  check("never constructs a userId/ownerId parameter of any kind", !/userId|ownerId/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[6] SavedJobs.jsx — reuses JobCard rather than duplicating its rendering, and shows real loading/empty/error/unauthenticated states");
{
  const source = readSource("pages/SavedJobs/SavedJobs.jsx");
  check("imports and renders the existing JobCard component", /import JobCard from ["'].*JobCard\.jsx["']/.test(source) && /<JobCard\s+job=\{job\}/.test(source));
  check("renders AuthRequired for a logged-out visitor instead of attempting the request", /isAuthenticated[\s\S]*?<AuthRequired/.test(source));
  check("has a real loading message", /Loading your saved jobs/.test(source));
  check("has a real empty-state message with a way to browse jobs", /haven't saved any jobs/.test(source) && /to="\/jobs"/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[7] The /saved-jobs route (already linked from Navbar.jsx) is now actually registered in App.jsx");
{
  const appSource = readSource("App.jsx");
  const navbarSource = readSource("components/Navbar/Navbar.jsx");
  check("App.jsx registers exactly one /saved-jobs route", (appSource.match(/path="\/saved-jobs"/g) || []).length === 1);
  check("it renders the real SavedJobs page component", /path="\/saved-jobs"\s+element=\{<SavedJobs\s*\/>\}/.test(appSource));
  check("Navbar.jsx's existing Saved Jobs link now has a matching destination", /to="\/saved-jobs"/.test(navbarSource));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
