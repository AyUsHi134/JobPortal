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

const adzunaEntityEncodedTitle = {
  ...adzunaComplete,
  id: "5900001238",
  title: "Backend Developer &amp; Node.js Lead",
  company: { display_name: "Fisher &amp; Sons" },
};
delete adzunaEntityEncodedTitle.salary_min;
delete adzunaEntityEncodedTitle.salary_max;

// Mojibake fixtures: title/company as they actually arrive from a source
// whose own data has UTF-8 bytes previously misread as Windows-1252 (see
// PHASE_1H4_REPORT.md §9's live-observed example). "â€™" is the mangled
// form of an apostrophe (U+2019); "Ã´" is the mangled form of "ô".
// Deliberately NOT the CTA/site-chrome phrase used by the Task #2 fixtures
// below ("Don't see your role? Apply here") — that phrase is now correctly
// rejected as placeholder/garbled, which would confound this fixture's own
// purpose of isolating mojibake *repair* in isolation from title *filtering*.
const adzunaMojibakeTitleAndCompany = {
  ...adzunaComplete,
  id: "5900001242",
  title: "Donâ€™t Miss This Backend Role",
  company: { display_name: "CÃ´te Brasserie Group" },
};
delete adzunaMojibakeTitleAndCompany.salary_min;
delete adzunaMojibakeTitleAndCompany.salary_max;

// Legitimate, already-correct accented text — must NOT be altered. Every
// one of these contains a character in the same Unicode range mojibake
// artifacts occupy (à-ï / Â-ß), which is exactly why they're chosen: they
// prove the hint-pattern pre-filter alone isn't what protects real text —
// the clean-round-trip check is what actually rejects these.
const adzunaLegitimateAccentedText = {
  ...adzunaComplete,
  id: "5900001243",
  title: "Château Wine Steward",
  company: { display_name: "São Paulo Digital Ltda" },
};
delete adzunaLegitimateAccentedText.salary_min;
delete adzunaLegitimateAccentedText.salary_max;

const adzunaPlaceholderTitle = {
  ...adzunaComplete,
  id: "5900001239",
  title: "Test Job",
};

const adzunaGarbledTitlePattern = {
  ...adzunaComplete,
  id: "5900001240",
  title: "Find a job 3rd comi",
};

const adzunaGarbledTitleExact = {
  ...adzunaComplete,
  id: "5900001241",
  title: "Sourcer Private Destinations",
};

const adzunaBareTestTitle = {
  ...adzunaComplete,
  id: "5900001244",
  title: "Test",
};

// The confirmed live CTA/site-chrome fragment, already correctly
// UTF-8-encoded (straight apostrophe) as a source might legitimately send it.
const adzunaCtaFragmentTitle = {
  ...adzunaComplete,
  id: "5900001245",
  title: "Don't see your role? Apply here",
};

// Same CTA fragment, but exactly as it would arrive from a source whose
// data has the Task #1 mojibake corruption — proves the full pipeline
// (repairMojibake -> isPlaceholderOrGarbledTitle) rejects it end-to-end,
// not just the already-repaired form.
const adzunaCtaFragmentTitleMojibake = {
  ...adzunaComplete,
  id: "5900001246",
  title: "Donâ€™t see your role? Apply here",
};

// Legitimate titles that must NOT be rejected merely for containing
// "test"/"hiring"/"apply"/"role" — the exact false-positive concerns this
// task called out. None of these equal any PLACEHOLDER_TITLE_EXACT entry
// or match either GARBLED_TITLE_PATTERNS regex.
const adzunaLegitimateTestEngineer = { ...adzunaComplete, id: "5900001247", title: "Test Engineer" };
const adzunaLegitimateHiringManager = { ...adzunaComplete, id: "5900001248", title: "Hiring Manager" };
const adzunaLegitimateNowHiringManager = { ...adzunaComplete, id: "5900001249", title: "Now Hiring Manager" };
const adzunaLegitimateReactRemote = { ...adzunaComplete, id: "5900001250", title: "React Developer - Remote" };
const adzunaLegitimateSeniorBackend = { ...adzunaComplete, id: "5900001251", title: "Senior Backend Developer" };

// Location mojibake fixtures (Task #3A) — display_name AND each area[]
// slot independently mojibake-corrupted, proving the same repair already
// applied to title/company (Task #1) now also reaches location fields.
// The positional area mapping itself ([country, state, city]) is
// unchanged — only the text inside each slot is repaired.
const adzunaLocationMojibake = {
  ...adzunaComplete,
  id: "5900001252",
  location: {
    area: ["PaÃ­s Exemplo", "SÃ£o Paulo", "MacaÃ©"],
    display_name: "MacaÃ©, Rio de Janeiro",
  },
};
delete adzunaLocationMojibake.salary_min;
delete adzunaLocationMojibake.salary_max;

// Already-correct accented location text — must remain byte-for-byte
// unchanged (same conservative round-trip safety net Task #1 already
// proved for title/company, now exercised on location).
const adzunaLocationLegitimateAccented = {
  ...adzunaComplete,
  id: "5900001253",
  location: {
    area: ["Brazil", "São Paulo", "São Paulo"],
    display_name: "São Paulo, Brazil",
  },
};
delete adzunaLocationLegitimateAccented.salary_min;
delete adzunaLocationLegitimateAccented.salary_max;

// HTML entities in location text must be decoded, same as title/company.
const adzunaLocationHtmlEntities = {
  ...adzunaComplete,
  id: "5900001254",
  location: {
    area: ["Canada", "Ontario", "Sault Ste. Marie &amp; Area"],
    display_name: "Sault Ste. Marie &amp; Area",
  },
};
delete adzunaLocationHtmlEntities.salary_min;
delete adzunaLocationHtmlEntities.salary_max;

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

const remoteOkEntityEncodedTitle = {
  ...remoteOkComplete,
  id: "1140006",
  slug: "remote-rd-engineer-1140006",
  position: "R&amp;D Engineer",
  company: "Bell &amp; Howell",
};

// Same mojibake shape as the Adzuna fixture above, on RemoteOK's fields
// (`position`/`company` instead of `title`/`company.display_name`).
const remoteOkMojibakeTitleAndCompany = {
  ...remoteOkComplete,
  id: "1140009",
  slug: "remote-cafe-ops-lead-1140009",
  position: "Donâ€™t miss this role",
  company: "CÃ´te Brasserie Remote Ops",
};

const remoteOkLegitimateAccentedText = {
  ...remoteOkComplete,
  id: "1140010",
  slug: "remote-chateau-ops-1140010",
  position: "Château Operations Lead",
  company: "São Paulo Digital Ltda",
};

const remoteOkPlaceholderTitle = {
  ...remoteOkComplete,
  id: "1140007",
  slug: "now-hiring-1140007",
  position: "Now Hiring",
};

const remoteOkGarbledTitle = {
  ...remoteOkComplete,
  id: "1140008",
  slug: "find-a-job-1140008",
  position: "Find a job 3rd comi",
};

const remoteOkBareTestTitle = {
  ...remoteOkComplete,
  id: "1140011",
  slug: "bare-test-title-1140011",
  position: "Test",
};

const remoteOkCtaFragmentTitle = {
  ...remoteOkComplete,
  id: "1140012",
  slug: "cta-fragment-1140012",
  position: "Don't see your role? Apply here",
};

const remoteOkCtaFragmentTitleMojibake = {
  ...remoteOkComplete,
  id: "1140013",
  slug: "cta-fragment-mojibake-1140013",
  position: "Donâ€™t see your role? Apply here",
};

const remoteOkLegitimateTestEngineer = { ...remoteOkComplete, id: "1140014", slug: "test-engineer-1140014", position: "Test Engineer" };
const remoteOkLegitimateHiringManager = { ...remoteOkComplete, id: "1140015", slug: "hiring-manager-1140015", position: "Hiring Manager" };
const remoteOkLegitimateNowHiringManager = { ...remoteOkComplete, id: "1140016", slug: "now-hiring-manager-1140016", position: "Now Hiring Manager" };
const remoteOkLegitimateReactRemote = { ...remoteOkComplete, id: "1140017", slug: "react-remote-1140017", position: "React Developer - Remote" };
const remoteOkLegitimateSeniorBackend = { ...remoteOkComplete, id: "1140018", slug: "senior-backend-1140018", position: "Senior Backend Developer" };

// Location mojibake fixture (Task #3A) — RemoteOK's location stays a
// single freeform string (never parsed into city/state/country), but that
// string still needs the same repair title/company already gets.
const remoteOkLocationMojibake = {
  ...remoteOkComplete,
  id: "1140019",
  slug: "remote-zurich-role-1140019",
  location: "ZÃ¼rich, Switzerland",
};

// Already-correct accented location text — must remain unchanged.
const remoteOkLocationLegitimateAccented = {
  ...remoteOkComplete,
  id: "1140020",
  slug: "remote-sao-paulo-role-1140020",
  location: "São Paulo, Brazil",
};

// HTML entities in location text must be decoded, same as title/company.
const remoteOkLocationHtmlEntities = {
  ...remoteOkComplete,
  id: "1140021",
  slug: "remote-sault-ste-marie-1140021",
  location: "Sault Ste. Marie &amp; Area",
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

console.log("\n[5d] Adzuna job with HTML-entity-encoded title and company");
const r5d = normalizeAdzunaJob(adzunaEntityEncodedTitle);
printSafeJob(r5d.job);
check("ok === true", r5d.ok === true);
check("title entities decoded", r5d.job?.title === "Backend Developer & Node.js Lead");
check("company entities decoded", r5d.job?.company === "Fisher & Sons");

console.log("\n[5d-2] Adzuna job with mojibake-corrupted title and company");
const r5d2 = normalizeAdzunaJob(adzunaMojibakeTitleAndCompany);
printSafeJob(r5d2.job);
check("ok === true", r5d2.ok === true);
check("title mojibake repaired", r5d2.job?.title === "Don’t Miss This Backend Role");
check("company mojibake repaired", r5d2.job?.company === "Côte Brasserie Group");

console.log("\n[5d-3] Adzuna job with legitimate, already-correct accented text (must remain unchanged)");
const r5d3 = normalizeAdzunaJob(adzunaLegitimateAccentedText);
printSafeJob(r5d3.job);
check("ok === true", r5d3.ok === true);
check("title unchanged (not mistaken for mojibake)", r5d3.job?.title === "Château Wine Steward");
check("company unchanged (not mistaken for mojibake)", r5d3.job?.company === "São Paulo Digital Ltda");

console.log("\n[5e] Adzuna job with placeholder title (\"Test Job\")");
const r5e = normalizeAdzunaJob(adzunaPlaceholderTitle);
check("ok === false (rejected as placeholder)", r5e.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5e.error?.reason || ""));

console.log("\n[5f] Adzuna job with garbled title matching pattern denylist (\"Find a job 3rd comi\")");
const r5f = normalizeAdzunaJob(adzunaGarbledTitlePattern);
check("ok === false (rejected as garbled)", r5f.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5f.error?.reason || ""));

console.log("\n[5g] Adzuna job with garbled title matching exact denylist (\"Sourcer Private Destinations\")");
const r5g = normalizeAdzunaJob(adzunaGarbledTitleExact);
check("ok === false (rejected as garbled)", r5g.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5g.error?.reason || ""));

console.log("\n[5h] Adzuna job with bare placeholder title (\"Test\")");
const r5h = normalizeAdzunaJob(adzunaBareTestTitle);
check("ok === false (rejected as placeholder)", r5h.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5h.error?.reason || ""));

console.log("\n[5i] Adzuna job with CTA/site-chrome fragment title (\"Don't see your role? Apply here\")");
const r5i = normalizeAdzunaJob(adzunaCtaFragmentTitle);
check("ok === false (rejected as placeholder/garbled)", r5i.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5i.error?.reason || ""));

console.log("\n[5j] Adzuna job with the same CTA fragment title, mojibake-corrupted (proves repair runs before this check, and the repaired form is still rejected)");
const r5j = normalizeAdzunaJob(adzunaCtaFragmentTitleMojibake);
check("ok === false (rejected as placeholder/garbled after mojibake repair)", r5j.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r5j.error?.reason || ""));

console.log("\n[5k] Legitimate titles containing \"test\"/\"hiring\"/\"apply\"/\"role\" must NOT be rejected");
const r5k1 = normalizeAdzunaJob(adzunaLegitimateTestEngineer);
check("\"Test Engineer\" is allowed", r5k1.ok === true && r5k1.job?.title === "Test Engineer");
const r5k2 = normalizeAdzunaJob(adzunaLegitimateHiringManager);
check("\"Hiring Manager\" is allowed", r5k2.ok === true && r5k2.job?.title === "Hiring Manager");
const r5k3 = normalizeAdzunaJob(adzunaLegitimateNowHiringManager);
check("\"Now Hiring Manager\" is allowed", r5k3.ok === true && r5k3.job?.title === "Now Hiring Manager");
const r5k4 = normalizeAdzunaJob(adzunaLegitimateReactRemote);
check("\"React Developer - Remote\" is allowed", r5k4.ok === true && r5k4.job?.title === "React Developer - Remote");
const r5k5 = normalizeAdzunaJob(adzunaLegitimateSeniorBackend);
check("\"Senior Backend Developer\" is allowed", r5k5.ok === true && r5k5.job?.title === "Senior Backend Developer");

console.log("\n[5l] Adzuna job with mojibake-corrupted location (display_name AND each area[] slot)");
const r5l = normalizeAdzunaJob(adzunaLocationMojibake);
printSafeJob(r5l.job);
check("ok === true", r5l.ok === true);
check("location.display_name repaired", r5l.job?.location.display_name === "Macaé, Rio de Janeiro");
check("location.raw repaired (same source string as display_name)", r5l.job?.location.raw === "Macaé, Rio de Janeiro");
check("location.country (area[0]) repaired", r5l.job?.location.country === "País Exemplo");
check("location.state (area[1]) repaired", r5l.job?.location.state === "São Paulo");
check("location.city (area[2]) repaired", r5l.job?.location.city === "Macaé");

console.log("\n[5m] Adzuna job with legitimate, already-correct accented location (must remain unchanged)");
const r5m = normalizeAdzunaJob(adzunaLocationLegitimateAccented);
printSafeJob(r5m.job);
check("ok === true", r5m.ok === true);
check("location.display_name unchanged", r5m.job?.location.display_name === "São Paulo, Brazil");
check("location.country unchanged", r5m.job?.location.country === "Brazil");
check("location.state unchanged", r5m.job?.location.state === "São Paulo");
check("location.city unchanged", r5m.job?.location.city === "São Paulo");

console.log("\n[5n] Adzuna job with HTML entities in location text");
const r5n = normalizeAdzunaJob(adzunaLocationHtmlEntities);
printSafeJob(r5n.job);
check("ok === true", r5n.ok === true);
check("location.display_name entities decoded", r5n.job?.location.display_name === "Sault Ste. Marie & Area");
check("location.city (area[2]) entities decoded", r5n.job?.location.city === "Sault Ste. Marie & Area");

console.log("\n[5o] Existing Adzuna location behavior unchanged when no cleanup is needed (regression check against test [1]'s fixture)");
check("location.raw/display_name unchanged for a clean source value", r1.job?.location.raw === "Pune, Maharashtra" && r1.job?.location.display_name === "Pune, Maharashtra");
check("location.country/state/city unchanged for clean source values", r1.job?.location.country === "India" && r1.job?.location.state === "Maharashtra" && r1.job?.location.city === "Pune");

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

console.log("\n[10d] RemoteOK job with HTML-entity-encoded title and company");
const r10d = normalizeRemoteOKJob(remoteOkEntityEncodedTitle);
printSafeJob(r10d.job);
check("ok === true", r10d.ok === true);
check("title entities decoded", r10d.job?.title === "R&D Engineer");
check("company entities decoded", r10d.job?.company === "Bell & Howell");

console.log("\n[10d-2] RemoteOK job with mojibake-corrupted title and company");
const r10d2 = normalizeRemoteOKJob(remoteOkMojibakeTitleAndCompany);
printSafeJob(r10d2.job);
check("ok === true", r10d2.ok === true);
check("title mojibake repaired", r10d2.job?.title === "Don’t miss this role");
check("company mojibake repaired", r10d2.job?.company === "Côte Brasserie Remote Ops");

console.log("\n[10d-3] RemoteOK job with legitimate, already-correct accented text (must remain unchanged)");
const r10d3 = normalizeRemoteOKJob(remoteOkLegitimateAccentedText);
printSafeJob(r10d3.job);
check("ok === true", r10d3.ok === true);
check("title unchanged (not mistaken for mojibake)", r10d3.job?.title === "Château Operations Lead");
check("company unchanged (not mistaken for mojibake)", r10d3.job?.company === "São Paulo Digital Ltda");

console.log("\n[10e] RemoteOK job with placeholder title (\"Now Hiring\")");
const r10e = normalizeRemoteOKJob(remoteOkPlaceholderTitle);
check("ok === false (rejected as placeholder)", r10e.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r10e.error?.reason || ""));

console.log("\n[10f] RemoteOK job with garbled title (\"Find a job 3rd comi\")");
const r10f = normalizeRemoteOKJob(remoteOkGarbledTitle);
check("ok === false (rejected as garbled)", r10f.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r10f.error?.reason || ""));

console.log("\n[10g] RemoteOK job with bare placeholder title (\"Test\")");
const r10g = normalizeRemoteOKJob(remoteOkBareTestTitle);
check("ok === false (rejected as placeholder)", r10g.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r10g.error?.reason || ""));

console.log("\n[10h] RemoteOK job with CTA/site-chrome fragment title (\"Don't see your role? Apply here\")");
const r10h = normalizeRemoteOKJob(remoteOkCtaFragmentTitle);
check("ok === false (rejected as placeholder/garbled)", r10h.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r10h.error?.reason || ""));

console.log("\n[10i] RemoteOK job with the same CTA fragment title, mojibake-corrupted (proves repair runs before this check, and the repaired form is still rejected)");
const r10i = normalizeRemoteOKJob(remoteOkCtaFragmentTitleMojibake);
check("ok === false (rejected as placeholder/garbled after mojibake repair)", r10i.ok === false);
check("error reason mentions placeholder/garbled", /placeholder|garbled/i.test(r10i.error?.reason || ""));

console.log("\n[10j] Legitimate titles containing \"test\"/\"hiring\"/\"apply\"/\"role\" must NOT be rejected");
const r10j1 = normalizeRemoteOKJob(remoteOkLegitimateTestEngineer);
check("\"Test Engineer\" is allowed", r10j1.ok === true && r10j1.job?.title === "Test Engineer");
const r10j2 = normalizeRemoteOKJob(remoteOkLegitimateHiringManager);
check("\"Hiring Manager\" is allowed", r10j2.ok === true && r10j2.job?.title === "Hiring Manager");
const r10j3 = normalizeRemoteOKJob(remoteOkLegitimateNowHiringManager);
check("\"Now Hiring Manager\" is allowed", r10j3.ok === true && r10j3.job?.title === "Now Hiring Manager");
const r10j4 = normalizeRemoteOKJob(remoteOkLegitimateReactRemote);
check("\"React Developer - Remote\" is allowed", r10j4.ok === true && r10j4.job?.title === "React Developer - Remote");
const r10j5 = normalizeRemoteOKJob(remoteOkLegitimateSeniorBackend);
check("\"Senior Backend Developer\" is allowed", r10j5.ok === true && r10j5.job?.title === "Senior Backend Developer");

console.log("\n[10k] RemoteOK job with mojibake-corrupted location (\"ZÃ¼rich, Switzerland\")");
const r10k = normalizeRemoteOKJob(remoteOkLocationMojibake);
printSafeJob(r10k.job);
check("ok === true", r10k.ok === true);
check("location.raw repaired", r10k.job?.location.raw === "Zürich, Switzerland");
check("location.display_name repaired", r10k.job?.location.display_name === "Zürich, Switzerland");
check("location.city/state/country remain null (never parsed/inferred)",
  r10k.job?.location.city === null && r10k.job?.location.state === null && r10k.job?.location.country === null);

console.log("\n[10l] RemoteOK job with legitimate, already-correct accented location (must remain unchanged)");
const r10l = normalizeRemoteOKJob(remoteOkLocationLegitimateAccented);
printSafeJob(r10l.job);
check("ok === true", r10l.ok === true);
check("location.raw unchanged", r10l.job?.location.raw === "São Paulo, Brazil");
check("location.display_name unchanged", r10l.job?.location.display_name === "São Paulo, Brazil");
check("location.city/state/country still null", r10l.job?.location.city === null && r10l.job?.location.state === null && r10l.job?.location.country === null);

console.log("\n[10m] RemoteOK job with HTML entities in location text");
const r10m = normalizeRemoteOKJob(remoteOkLocationHtmlEntities);
printSafeJob(r10m.job);
check("ok === true", r10m.ok === true);
check("location.raw entities decoded", r10m.job?.location.raw === "Sault Ste. Marie & Area");
check("location.display_name entities decoded", r10m.job?.location.display_name === "Sault Ste. Marie & Area");

console.log("\n[10n] Existing RemoteOK location behavior unchanged when no cleanup is needed (regression check against test [6]'s fixture)");
check("location.raw/display_name unchanged for a clean source value", r6.job?.location.raw === "Berlin, Germany" && r6.job?.location.display_name === "Berlin, Germany");
check("location.city/state/country still null for a clean source value", r6.job?.location.city === null && r6.job?.location.state === null && r6.job?.location.country === null);

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
console.log("\nNo live API calls were made and no MongoDB connection was attempted.");

if (failCount > 0) process.exitCode = 1;
