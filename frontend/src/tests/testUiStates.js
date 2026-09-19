// UI states static verification

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.jsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

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

console.log("============================");
console.log(" LOADING / EMPTY / ERROR / AUTH-REQUIRED STATES — STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] Loading states across the app are announced to assistive tech (role=\"status\"/aria-live), not just visually shown");
{
  const loadingSites = [
    ["JobDescription.jsx (Job Detail)", "pages/JobDescription/JobDescription.jsx", /Loading job details/],
    ["FindJob.jsx (Job Discovery)", "pages/FindJob/FindJob.jsx", /Loading jobs/],
    ["SavedJobs.jsx", "pages/SavedJobs/SavedJobs.jsx", /Loading your saved jobs/],
    ["Profile.jsx", "pages/Profile.jsx", /Loading your profile/],
  ];
  for (const [label, relPath, textPattern] of loadingSites) {
    const source = readSource(relPath);
    check(`${label} still shows its real loading message (text unchanged)`, textPattern.test(source));
    const loadingLine = source.split("\n").find((line) => textPattern.test(line));
    check(`${label}'s loading message carries role="status" (or aria-live) for assistive tech`, Boolean(loadingLine) && /role="status"|aria-live/.test(loadingLine));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[2] Error states are marked role=\"alert\" and never contain raw backend/Axios/Mongo internals");
{
  const errorSites = [
    ["JobDescription.jsx", "pages/JobDescription/JobDescription.jsx"],
    ["FindJob.jsx", "pages/FindJob/FindJob.jsx"],
    ["SavedJobs.jsx", "pages/SavedJobs/SavedJobs.jsx"],
    ["Profile.jsx", "pages/Profile.jsx"],
    ["Login.jsx", "pages/Login/Login.jsx"],
  ];
  for (const [label, relPath] of errorSites) {
    const source = readSource(relPath);
    check(`${label} marks its error text with role="alert"`, /role="alert"/.test(source));
    check(`${label} contains no raw Axios/Mongo-shaped string`, !/AxiosError|CastError|mongodb:\/\/|MongoError/i.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[3] Every page gated behind authentication shows the SAME shared AuthRequired presentation — not three different hand-written 'please log in' UIs");
{
  const protectedPages = ["pages/AddJob.jsx", "pages/Profile.jsx", "pages/SavedJobs/SavedJobs.jsx"];
  for (const relPath of protectedPages) {
    const source = readSource(relPath);
    check(`${relPath} renders the shared <AuthRequired /> component`, /<AuthRequired\b/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[4] Empty states explain what's empty AND offer a next action, not just a bare 'nothing here'");
{
  const savedJobs = readSource("pages/SavedJobs/SavedJobs.jsx");
  check("Saved Jobs empty state explains the situation", /haven't saved any jobs yet/.test(savedJobs));
  check("...and offers a concrete next action (a link to browse jobs)", /Browse jobs/.test(savedJobs) && /to="\/jobs"/.test(savedJobs));

  const findJob = readSource("pages/FindJob/FindJob.jsx");
  // Richer no-results state check
  check("Job Discovery distinguishes 'nothing exists yet' from 'your filters matched nothing' (two different situations, two different messages)", /No active jobs are available right now/.test(findJob) && /No jobs found/.test(findJob) && /no-results__title/.test(findJob));
}

// ---------------------------------------------------------------------------
console.log("\n[5] The Saved Jobs page supports real unsave — the old 'can't be removed' limitation notice is gone now that the capability exists");
{
  const source = readSource("pages/SavedJobs/SavedJobs.jsx");
  check("the old 'jobs can't be removed from this list' disclaimer is gone", !/can.t be removed from this list/.test(source));
  check("a real handleUnsaved handler exists and is wired to JobCard", /handleUnsaved/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[6] No direct fetch/axios call exists anywhere in application source (whole-tree sweep, not just the handful of files Phase 2C's own check covers)");
{
  const offenders = [];
  for (const file of walk(SRC_DIR).filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.includes(`${path.sep}services${path.sep}`))) {
    const source = fs.readFileSync(file, "utf8");
    if (/\bfetch\(/.test(source) || /\baxios\b/.test(source)) offenders.push(path.relative(SRC_DIR, file));
  }
  check("zero application-source files (outside services/) contain a direct fetch()/axios call", offenders.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[7] No Adzuna/RemoteOK API-call pattern exists anywhere in application source (whole-tree sweep)");
{
  const HOSTNAME_PATTERN = /adzuna\.(com|in)|remoteok\.(com|io)|api\.adzuna/i;
  const CALL_SITE_PATTERN = /(fetch|axios[.\w]*)\s*\([^)]*(adzuna|remoteok)/i;
  const offenders = [];
  for (const file of walk(SRC_DIR).filter((f) => !f.includes(`${path.sep}tests${path.sep}`))) {
    const source = fs.readFileSync(file, "utf8");
    if (HOSTNAME_PATTERN.test(source) || CALL_SITE_PATTERN.test(source)) offenders.push(path.relative(SRC_DIR, file));
  }
  check("zero application-source files contain an Adzuna/RemoteOK hostname or call-site pattern", offenders.length === 0);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
