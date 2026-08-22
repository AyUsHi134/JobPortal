// Deterministic, fixture-based verification for the Phase 1E normalizers.
// This script does NOT call any live API and does NOT connect to
// MongoDB — it imports only the two pure normalization functions and
// runs them against small, synthetic (non-real) sample objects shaped
// like the real raw structures documented in JOB_API_DATA_REPORT.md,
// ADZUNA_LIVE_TEST.md, and PHASE_1D_REPORT.md.
//
// Run via: node backend/scripts/testNormalizers.js

import { normalizeAdzunaJob } from "../integrations/jobs/adzunaNormalizer.js";
import { normalizeRemoteOKJob } from "../integrations/jobs/remoteOkNormalizer.js";

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

function truncate(str, n = 40) {
  if (typeof str !== "string") return str;
  return str.length > n ? str.slice(0, n) + "...[truncated]" : str;
}

function printSafeJob(job) {
  if (!job) {
    console.log("  (no job)");
    return;
  }
  const safe = { ...job, description: truncate(job.description) };
  console.log("  " + JSON.stringify(safe));
}

// ---------------------------------------------------------------------
// ADZUNA FIXTURES (synthetic — fictional company/id, shaped per
// ADZUNA_LIVE_TEST.md's confirmed live field structure)
// ---------------------------------------------------------------------

const adzunaComplete = {
  title: "Backend Developer (Node.js)",
  company: { __CLASS__: "Adzuna::API::Response::Company", display_name: "Brightline Systems Pvt Ltd" },
  description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
  redirect_url: "https://www.adzuna.in/land/ad/5900001234?se=abc123&utm_medium=api",
  location: {
    __CLASS__: "Adzuna::API::Response::Location",
    area: ["India", "Maharashtra", "Pune"],
    display_name: "Pune, Maharashtra",
  },
  created: "2026-08-10T09:15:00Z",
  id: "5900001234",
  category: { __CLASS__: "Adzuna::API::Response::Category", tag: "it-jobs", label: "IT Jobs" },
  contract_time: "full_time",
  salary_min: 800000,
  salary_max: 1200000,
  salary_is_predicted: "0",
  latitude: 18.5062,
  longitude: 73.84735,
  adref: "eyJhbGciOiJIUzI1NiJ9.fake.token",
  __CLASS__: "Adzuna::API::Response::Job",
};

const adzunaMissingSalary = {
  ...adzunaComplete,
  id: "5900001235",
  title: "Fullstack Software Developer",
  company: { display_name: "Kyndryl" },
};
delete adzunaMissingSalary.salary_min;
delete adzunaMissingSalary.salary_max;
delete adzunaMissingSalary.salary_is_predicted;

const adzunaMissingCompanyLocationDetail = {
  ...adzunaComplete,
  id: "5900001236",
  title: "Software Engineer",
  company: {}, // no display_name at all
  location: { area: ["India"], display_name: "India" }, // country only, no state/city
};
delete adzunaMissingCompanyLocationDetail.salary_min;
delete adzunaMissingCompanyLocationDetail.salary_max;

const adzunaRemoteSignal = {
  ...adzunaComplete,
  id: "5900001237",
  title: "Remote Backend Engineer",
  location: { area: ["India"], display_name: "Remote, India" },
};

const adzunaMalformedMissingTitle = {
  // no title, no company, no id
  description: "Some description",
};

// ---------------------------------------------------------------------
// REMOTEOK FIXTURES (synthetic — shaped per JOB_API_DATA_REPORT.md's
// confirmed live field structure)
// ---------------------------------------------------------------------

const remoteOkComplete = {
  slug: "remote-senior-react-engineer-nimbus-cloud-labs-1140002",
  id: "1140002",
  epoch: 1786700000,
  date: "2026-08-14T12:49:18+00:00",
  company: "Nimbus Cloud Labs",
  company_logo: "",
  position: "Senior React Engineer",
  tags: ["react", "javascript", "frontend", "full time"],
  description: "We're hiring a remote Senior React Engineer to help build our dashboard product.",
  location: "Berlin, Germany",
  apply_url: "https://remoteok.com/remote-jobs/remote-senior-react-engineer-nimbus-cloud-labs-1140002",
  salary_min: 90000,
  salary_max: 130000,
  logo: "",
  url: "https://remoteok.com/remote-jobs/remote-senior-react-engineer-nimbus-cloud-labs-1140002",
};

const remoteOkMissingSalary = {
  ...remoteOkComplete,
  id: "1140003",
  slug: "remote-frontend-engineer-acme-1140003",
  position: "Frontend Engineer",
  salary_min: 0,
  salary_max: 0,
};

const remoteOkIncompleteLocation = {
  ...remoteOkComplete,
  id: "1140004",
  slug: "remote-python-developer-databyte-1140004",
  position: "Python Developer",
  company: "Databyte",
  location: "Remote", // present but carries no city/state/country structure
  salary_min: 0,
  salary_max: 0,
};

const remoteOkEpochOnly = {
  ...remoteOkComplete,
  id: "1140005",
  slug: "remote-devops-engineer-1140005",
  position: "DevOps Engineer",
  date: undefined, // force fallback to epoch
};

const remoteOkMalformedMissingFields = {
  // no position, no company, no id, no slug
  description: "Some description",
  location: "Remote",
};

// ---------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------

console.log("============================");
console.log(" ADZUNA NORMALIZER TESTS");
console.log("============================");

console.log("\n[1] Complete Adzuna job (with real salary)");
const r1 = normalizeAdzunaJob(adzunaComplete);
printSafeJob(r1.job);
check("ok === true", r1.ok === true);
check("title mapped", r1.job?.title === "Backend Developer (Node.js)");
check("company mapped from nested display_name", r1.job?.company === "Brightline Systems Pvt Ltd");
check("location.country === India", r1.job?.location.country === "India");
check("location.state === Maharashtra", r1.job?.location.state === "Maharashtra");
check("location.city === Pune", r1.job?.location.city === "Pune");
check("salary.min preserved as real number", r1.job?.salary.min === 800000);
check("salary.max preserved as real number", r1.job?.salary.max === 1200000);
check("salary.is_estimated === false (from '0')", r1.job?.salary.is_estimated === false);
check("job_type === full_time", r1.job?.job_type === "full_time");
check("source_category === IT Jobs", r1.job?.source_category === "IT Jobs");
check("source === adzuna", r1.job?.source === "adzuna");
check("source_id === '5900001234'", r1.job?.source_id === "5900001234");
check("apply_link uses redirect_url", r1.job?.apply_link === adzunaComplete.redirect_url);
check("date_posted is a real Date", r1.job?.date_posted instanceof Date);
check("experience_level default preserved", r1.job?.experience_level === "unknown");
check("is_tech_relevant default preserved (null)", r1.job?.is_tech_relevant === null);
check("is_remote is null (no remote signal in location text)", r1.job?.is_remote === null);
check("tech_relevance_source default preserved", r1.job?.tech_relevance_source === "unclassified");

console.log("\n[2] Adzuna job with missing salary (typical majority case)");
const r2 = normalizeAdzunaJob(adzunaMissingSalary);
printSafeJob(r2.job);
check("ok === true", r2.ok === true);
check("salary.min === null (not 0, not fabricated)", r2.job?.salary.min === null);
check("salary.max === null", r2.job?.salary.max === null);
check("salary.is_estimated === null (no salary to estimate)", r2.job?.salary.is_estimated === null);

console.log("\n[3] Adzuna job with missing company/location detail");
const r3 = normalizeAdzunaJob(adzunaMissingCompanyLocationDetail);
printSafeJob(r3.job);
check("ok === false (company.display_name missing entirely)", r3.ok === false);
check("error reason mentions company", /company/.test(r3.error?.reason || ""));

console.log("\n[4] Adzuna job with explicit 'Remote' in location text");
const r4 = normalizeAdzunaJob(adzunaRemoteSignal);
check("ok === true", r4.ok === true);
check("is_remote === true (explicit text signal)", r4.job?.is_remote === true);

console.log("\n[5] Malformed Adzuna input (missing title/company/id)");
const r5 = normalizeAdzunaJob(adzunaMalformedMissingTitle);
check("ok === false, no crash", r5.ok === false);
check("error reason is non-empty", typeof r5.error?.reason === "string" && r5.error.reason.length > 0);

console.log("\n[5b] Malformed Adzuna input (null / not an object)");
const r5b = normalizeAdzunaJob(null);
check("ok === false for null input, no crash", r5b.ok === false);
const r5c = normalizeAdzunaJob("just a string");
check("ok === false for string input, no crash", r5c.ok === false);

console.log("\n============================");
console.log(" REMOTEOK NORMALIZER TESTS");
console.log("============================");

console.log("\n[6] Complete RemoteOK job (with real salary)");
const r6 = normalizeRemoteOKJob(remoteOkComplete);
printSafeJob(r6.job);
check("ok === true", r6.ok === true);
check("title mapped from position", r6.job?.title === "Senior React Engineer");
check("company mapped", r6.job?.company === "Nimbus Cloud Labs");
check("apply_link uses apply_url", r6.job?.apply_link === remoteOkComplete.apply_url);
check("salary.min preserved as real number", r6.job?.salary.min === 90000);
check("salary.max preserved as real number", r6.job?.salary.max === 130000);
check("tags passed through raw", Array.isArray(r6.job?.tags) && r6.job.tags.includes("react"));
check("is_remote hardcoded true", r6.job?.is_remote === true);
check("job_type stays unknown (never derived from tags)", r6.job?.job_type === "unknown");
check("source === remoteok", r6.job?.source === "remoteok");
check("source_id === '1140002'", r6.job?.source_id === "1140002");
check("location.city is null (never guessed)", r6.job?.location.city === null);
check("date_posted is a real Date", r6.job?.date_posted instanceof Date);

console.log("\n[7] RemoteOK job with missing salary (literal 0/0, typical majority case)");
const r7 = normalizeRemoteOKJob(remoteOkMissingSalary);
check("ok === true", r7.ok === true);
check("salary.min === null (0 treated as not provided)", r7.job?.salary.min === null);
check("salary.max === null", r7.job?.salary.max === null);

console.log("\n[8] RemoteOK job with incomplete location (present but unstructured)");
const r8 = normalizeRemoteOKJob(remoteOkIncompleteLocation);
check("ok === true", r8.ok === true);
check("location.raw preserved", r8.job?.location.raw === "Remote");
check("location.city/state/country all null (never guessed)",
  r8.job?.location.city === null && r8.job?.location.state === null && r8.job?.location.country === null);

console.log("\n[9] RemoteOK job with epoch-only date (date field missing)");
const r9 = normalizeRemoteOKJob(remoteOkEpochOnly);
check("ok === true", r9.ok === true);
check("date_posted derived from epoch fallback", r9.job?.date_posted instanceof Date);

console.log("\n[10] Malformed RemoteOK input (missing position/company/id/slug)");
const r10 = normalizeRemoteOKJob(remoteOkMalformedMissingFields);
check("ok === false, no crash", r10.ok === false);
check("error reason is non-empty", typeof r10.error?.reason === "string" && r10.error.reason.length > 0);

console.log("\n[10b] Malformed RemoteOK input (undefined / empty object)");
const r10b = normalizeRemoteOKJob(undefined);
check("ok === false for undefined input, no crash", r10b.ok === false);
const r10c = normalizeRemoteOKJob({});
check("ok === false for empty object input, no crash", r10c.ok === false);

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
console.log("\nNo live API calls were made and no MongoDB connection was attempted.");

if (failCount > 0) process.exitCode = 1;
