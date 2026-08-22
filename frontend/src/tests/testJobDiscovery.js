// Deterministic, integration-style verification for the Phase 2C Job
// Discovery feature as a whole: that an initial (no-filter) listing
// request resolves into correctly-shaped, fully-formattable job data,
// plus the required static checks — no new direct fetch/axios calls
// were introduced outside the service layer, no Adzuna/RemoteOK
// references exist anywhere in the frontend, and JobCard's existing
// navigation to the future Job Detail route is preserved. No real
// network call is made for the data-flow checks; the static checks read
// the actual source files on disk. Run via
// `node src/tests/testJobDiscovery.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

const { apiClient } = await import("../services/api.js");
const { listJobs } = await import("../services/jobsApi.js");
const { formatLocation, formatSalary, formatExperience, formatRemote } = await import("../utils/jobDisplay.js");

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

function mockAdapter({ status = 200, data = {} } = {}, captureConfig) {
  return async (config) => {
    if (captureConfig) captureConfig(config);
    return { data, status, statusText: "", headers: {}, config, request: {} };
  };
}

// A representative page of realistic, varied active jobs — mirrors the
// actual field combinations documented in BACKEND_API_CONTRACT.md §2/§9
// (a RemoteOK-shaped job with mostly-null location/salary/experience,
// and an Adzuna-shaped job with fuller structured data).
const REALISTIC_PAGE = [
  {
    _id: "6a0000000000000000000001",
    title: "Cabin Cleaning Agent",
    company: "Menzies Aviation",
    description: "desc",
    apply_link: "https://remoteok.com/remote-jobs/1",
    location: { raw: "Hounslow,", display_name: "Hounslow,", city: null, state: null, country: null },
    salary: { min: null, max: null, currency: null, is_estimated: null },
    job_type: "unknown",
    is_remote: true,
    experience_level: "unknown",
    is_tech_relevant: false,
    tech_relevance_source: "keyword_heuristic",
    source_category: null,
    tags: [],
    normalized_skills: [],
    logo: "",
    date_posted: "2026-08-15T16:07:53.000Z",
    status: "active",
    source: "remoteok",
    source_id: "1136812",
  },
  {
    _id: "6a0000000000000000000002",
    title: "Backend Developer (Node.js)",
    company: "Brightline Systems",
    description: "desc",
    apply_link: "https://www.adzuna.in/land/ad/1",
    location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
    salary: { min: 800000, max: 1200000, currency: "INR", is_estimated: false },
    job_type: "full_time",
    is_remote: null,
    experience_level: "mid",
    is_tech_relevant: true,
    tech_relevance_source: "source_category",
    source_category: "IT Jobs",
    tags: [],
    normalized_skills: ["node.js", "javascript"],
    logo: "",
    date_posted: "2026-08-10T09:15:00.000Z",
    status: "active",
    source: "adzuna",
    source_id: "5900001234",
  },
];

console.log("============================");
console.log(" JOB DISCOVERY — INTEGRATION & STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] An initial, no-filter listing request resolves into correctly-shaped, fully-formattable job data");
{
  apiClient.defaults.adapter = mockAdapter({
    status: 200,
    data: { success: true, data: REALISTIC_PAGE, pagination: { page: 1, limit: 20, total: 113, totalPages: 6 } },
  });

  const { jobs, pagination } = await listJobs();

  check("2 jobs returned, matching the mocked page", jobs.length === 2);
  check("pagination metadata is present and correctly shaped", pagination.total === 113 && pagination.totalPages === 6 && pagination.page === 1);

  const [remoteOkJob, adzunaJob] = jobs;

  // The RemoteOK-shaped job: mostly-null structured fields must degrade
  // gracefully through the exact same formatters JobCard.jsx uses.
  // Phase 2G-2 fix: formatLocation() now strips a stray trailing comma
  // left over from source data ("Hounslow," in this exact mocked
  // RemoteOK-shaped record) instead of passing it through verbatim — this
  // assertion previously encoded that trailing-comma bug as expected
  // behavior; it is corrected here, not the formatter (see
  // utils/jobDisplay.js#cleanLocationText and PHASE_2G2_REPORT.md §3).
  check("RemoteOK job's location formats from `raw`, with the source's trailing comma cleaned off", formatLocation(remoteOkJob.location) === "Hounslow");
  check("RemoteOK job's salary is correctly absent (both min/max null) — no fake figure", formatSalary(remoteOkJob.salary) === null);
  check("RemoteOK job's experience_level ('unknown') never renders as a confirmed level", formatExperience(remoteOkJob.experience_level) === null);
  check("RemoteOK job's is_remote (true) renders as a confirmed 'Remote'", formatRemote(remoteOkJob.is_remote) === "Remote");

  // The Adzuna-shaped job: fuller structured data renders the real values.
  check("Adzuna job's location prefers display_name", formatLocation(adzunaJob.location) === "Pune, Maharashtra");
  check("Adzuna job's salary renders the real structured range", formatSalary(adzunaJob.salary) === "INR 800,000 – 1,200,000");
  check("Adzuna job's experience_level ('mid') renders a real label", formatExperience(adzunaJob.experience_level) === "Mid Level");
  check("Adzuna job's is_remote (null) correctly renders as unknown, not 'On-site'", formatRemote(adzunaJob.is_remote) === null);
}

// ---------------------------------------------------------------------------
console.log("\n[2] No direct fetch/axios calls exist outside the centralized service layer");
{
  const filesToCheck = [
    "pages/FindJob/FindJob.jsx",
    "pages/Home.jsx",
    "components/JobCard/JobCard.jsx",
  ];
  for (const relPath of filesToCheck) {
    const source = fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
    check(`${relPath} contains no direct fetch(...) call`, !/\bfetch\(/.test(source));
    check(`${relPath} contains no direct axios usage`, !/\baxios\b/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[3] No direct Adzuna/RemoteOK API calls exist anywhere in the frontend source");
{
  // Deliberately checks for API-CALL-shaped patterns (a hostname, or the
  // word appearing as an argument to fetch/axios) rather than any
  // mention of the words "adzuna"/"remoteok" at all — FindJob.jsx's
  // Source filter legitimately uses the literal strings "adzuna"/
  // "remoteok" as filter *values* (exactly what this phase's task
  // requires: "Source: all / Adzuna / RemoteOK"), matching the backend's
  // own documented `source` field values, not a network call. A blanket
  // text search would flag that legitimate UI as a false positive.
  function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, files);
      else if (/\.(jsx?|scss)$/.test(entry.name)) files.push(full);
    }
    return files;
  }

  const HOSTNAME_PATTERN = /adzuna\.(com|in)|remoteok\.(com|io)|api\.adzuna/i;
  const CALL_SITE_PATTERN = /(fetch|axios[.\w]*)\s*\([^)]*(adzuna|remoteok)/i;

  const allSourceFiles = walk(SRC_DIR).filter((f) => !f.includes(`${path.sep}tests${path.sep}`));
  const offenders = [];
  for (const file of allSourceFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (HOSTNAME_PATTERN.test(source) || CALL_SITE_PATTERN.test(source)) {
      offenders.push(path.relative(SRC_DIR, file));
    }
  }
  check("zero application-source files contain an Adzuna/RemoteOK hostname or call-site pattern", offenders.length === 0);

  // Confirm the check itself is actually discriminating, not just always
  // passing — the Source filter's plain "adzuna"/"remoteok" strings must
  // NOT trip the (correctly narrower) patterns above.
  const findJobSource = fs.readFileSync(path.join(SRC_DIR, "pages/FindJob/FindJob.jsx"), "utf8");
  check("FindJob.jsx's Source filter option values are present (the legitimate case this check must not flag)", /"adzuna"/.test(findJobSource) && /"remoteok"/.test(findJobSource));
  check("...and correctly do NOT match the API-call-site pattern", !CALL_SITE_PATTERN.test(findJobSource) && !HOSTNAME_PATTERN.test(findJobSource));
}

// ---------------------------------------------------------------------------
console.log("\n[4] JobCard's existing navigation to the future Job Detail route is preserved");
{
  const source = fs.readFileSync(path.join(SRC_DIR, "components/JobCard/JobCard.jsx"), "utf8");
  check("the Apply button still navigates to /job/:id (Phase 2D's route, unchanged)", /navigate\(`\/job\/\$\{job\._id\}`\)/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[5] FindJob.jsx and Home.jsx source their job data exclusively from the centralized jobsApi");
{
  for (const relPath of ["pages/FindJob/FindJob.jsx", "pages/Home.jsx"]) {
    const source = fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
    check(`${relPath} imports listJobs from services/jobsApi.js`, /from ["'].*services\/jobsApi\.js["']/.test(source) && /listJobs/.test(source));
  }
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
