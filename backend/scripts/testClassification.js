// Deterministic, fixture-based verification for the Phase 1F
// classification layer. No live API calls, no MongoDB connection, no
// jobService — imports only the pure classification functions and runs
// them against small, synthetic (non-real) sample objects shaped like
// Phase 1E's normalized Job output.
//
// Run via: node backend/scripts/testClassification.js

import { classifyTechRelevance } from "../integrations/jobs/techRelevanceClassifier.js";
import { classifyExperienceLevel } from "../integrations/jobs/experienceClassifier.js";
import { deriveNormalizedSkills } from "../integrations/jobs/skillsExtractor.js";
import { classifyJob } from "../integrations/jobs/classifyJob.js";

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

function job(overrides) {
  return {
    title: "Untitled",
    description: "No description.",
    company: "Example Co",
    source: "remoteok",
    tags: [],
    source_category: null,
    ...overrides,
  };
}

console.log("============================");
console.log(" TECH RELEVANCE TESTS");
console.log("============================");

console.log("\n[1] Clear software developer job");
const j1 = job({ title: "Software Developer", description: "We need a software developer to build our web application." });
const r1 = classifyTechRelevance(j1);
check("is_tech_relevant === true", r1.is_tech_relevant === true);
check("tech_relevance_source === keyword_heuristic", r1.tech_relevance_source === "keyword_heuristic");

console.log("\n[2] Clear frontend developer job");
const j2 = job({ title: "Frontend Developer", description: "Build beautiful UIs for our customers." });
const r2 = classifyTechRelevance(j2);
check("is_tech_relevant === true", r2.is_tech_relevant === true);

console.log("\n[3] Clear backend developer job");
const j3 = job({ title: "Backend Developer", description: "Design and build our server-side APIs." });
const r3 = classifyTechRelevance(j3);
check("is_tech_relevant === true", r3.is_tech_relevant === true);

console.log("\n[4] Clear full-stack developer job");
const j4 = job({ title: "Full Stack Developer", description: "Work across our entire product stack." });
const r4 = classifyTechRelevance(j4);
check("is_tech_relevant === true", r4.is_tech_relevant === true);

console.log("\n[5] Clear non-tech job (Sales Executive)");
const j5 = job({ title: "Sales Executive", description: "Join our sales team to drive revenue growth." });
const r5 = classifyTechRelevance(j5);
check("is_tech_relevant === false (hard exclusion)", r5.is_tech_relevant === false);
check("tech_relevance_source === keyword_heuristic", r5.tech_relevance_source === "keyword_heuristic");

console.log("\n[6] Adzuna 'IT Jobs' category + technical title");
const j6 = job({ title: "Software Engineer", description: "Generic description.", source: "adzuna", source_category: "IT Jobs" });
const r6 = classifyTechRelevance(j6);
check("is_tech_relevant === true", r6.is_tech_relevant === true);
check("tech_relevance_source === source_category (category prioritized)", r6.tech_relevance_source === "source_category");

console.log("\n[7] Adzuna 'IT Jobs' category + clearly non-technical title (synthetic edge case)");
const j7 = job({ title: "Sales Executive", description: "Generic description.", source: "adzuna", source_category: "IT Jobs" });
const r7 = classifyTechRelevance(j7);
check("is_tech_relevant === false (title exclusion overrides category)", r7.is_tech_relevant === false);
check("tech_relevance_source === keyword_heuristic (not source_category)", r7.tech_relevance_source === "keyword_heuristic");

console.log("\n[8] Generic/non-IT Adzuna category + clearly technical title");
const j8 = job({ title: "Software Developer", description: "Generic description.", source: "adzuna", source_category: "Engineering Jobs" });
const r8 = classifyTechRelevance(j8);
check("is_tech_relevant === true (title carries it, category doesn't help)", r8.is_tech_relevant === true);
check("tech_relevance_source === keyword_heuristic", r8.tech_relevance_source === "keyword_heuristic");

console.log("\n============================");
console.log(" EXPERIENCE LEVEL TESTS");
console.log("============================");

console.log("\n[9] Fresher/graduate role");
const j9 = job({ title: "Graduate Software Engineer", description: "Great first role after university." });
check("experience_level === fresher", classifyExperienceLevel(j9) === "fresher");

console.log("\n[10] Entry-level role");
const j10 = job({ title: "Entry-Level Software Developer", description: "Generic description." });
check("experience_level === entry", classifyExperienceLevel(j10) === "entry");

console.log("\n[11] Junior role");
const j11 = job({ title: "Junior Developer", description: "Generic description." });
check("experience_level === junior", classifyExperienceLevel(j11) === "junior");

console.log("\n[12] Explicit 0-1 years role");
const j12 = job({ title: "Software Developer", description: "0-1 years of experience required." });
check("experience_level === fresher (0-1 years)", classifyExperienceLevel(j12) === "fresher");

console.log("\n[13] Mid-level role");
const j13 = job({ title: "Software Developer", description: "We require 3-5 years of relevant experience." });
check("experience_level === mid (3-5 years)", classifyExperienceLevel(j13) === "mid");

console.log("\n[14] Senior role");
const j14 = job({ title: "Senior Software Engineer", description: "Generic description." });
check("experience_level === senior", classifyExperienceLevel(j14) === "senior");

console.log("\n[15] Lead/manager role");
const j15 = job({ title: "Engineering Manager", description: "Generic description." });
check("experience_level === senior (manager)", classifyExperienceLevel(j15) === "senior");

console.log("\n[16] Conflicting fresher and senior signals (title wins)");
const j16 = job({
  title: "Senior Software Developer",
  description: "We welcome recent graduates to apply and grow into this role.",
});
check(
  "experience_level === senior (title precedence over description graduate mention)",
  classifyExperienceLevel(j16) === "senior"
);

console.log("\n[17] Ambiguous role with insufficient evidence");
const j17 = job({ title: "Software Developer", description: "Join our engineering team and help build great products." });
check("experience_level === unknown", classifyExperienceLevel(j17) === "unknown");

console.log("\n[18] Missing experience information (detailed but silent on experience)");
const j18 = job({
  title: "Data Analyst",
  description: "You will work with SQL and build dashboards for stakeholders across the company.",
});
check("experience_level === unknown (no fresher assumed)", classifyExperienceLevel(j18) === "unknown");

console.log("\n[19] Missing optional fields entirely (no tags, no source_category keys)");
const j19 = { title: "Python Developer", description: "We need a python developer.", source: "adzuna" };
let j19Threw = false;
let j19Result;
try {
  j19Result = classifyJob(j19);
} catch (e) {
  j19Threw = true;
}
check("classifyJob does not throw on missing optional fields", !j19Threw);
check("is_tech_relevant === true (title match still works)", j19Result?.is_tech_relevant === true);
check("experience_level === unknown", j19Result?.experience_level === "unknown");
check("normalized_skills includes 'python'", Array.isArray(j19Result?.normalized_skills) && j19Result.normalized_skills.includes("python"));

console.log("\n============================");
console.log(" REPRESENTATIVE PHASE 1E EXAMPLES");
console.log("============================");

console.log("\n[20] Representative normalized Adzuna job (from PHASE_1E_REPORT.md §9)");
const adzunaExample = {
  title: "Backend Developer (Node.js)",
  company: "Brightline Systems Pvt Ltd",
  description: "We are looking for a Backend Developer to join our growing engineering team in Pune.",
  apply_link: "https://www.adzuna.in/land/ad/5900001234?se=abc123&utm_medium=api",
  location: { raw: "Pune, Maharashtra", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" },
  tags: [],
  salary: { min: 800000, max: 1200000, currency: null, is_estimated: false },
  job_type: "full_time",
  is_remote: null,
  source_category: "IT Jobs",
  source: "adzuna",
  source_id: "5900001234",
};
const adzunaClassified = classifyJob(adzunaExample);
console.log("  " + JSON.stringify({ ...adzunaClassified, description: truncate(adzunaClassified.description) }));
check("is_tech_relevant === true", adzunaClassified.is_tech_relevant === true);
check("tech_relevance_source === source_category", adzunaClassified.tech_relevance_source === "source_category");
check("experience_level === unknown (no tier language present)", adzunaClassified.experience_level === "unknown");
check("original fields preserved (company)", adzunaClassified.company === "Brightline Systems Pvt Ltd");
check("original fields preserved (location.city)", adzunaClassified.location.city === "Pune");
check("original fields preserved (source_id)", adzunaClassified.source_id === "5900001234");

console.log("\n[21] Representative normalized RemoteOK job (from PHASE_1E_REPORT.md §10)");
const remoteOkExample = {
  title: "Senior React Engineer",
  company: "Nimbus Cloud Labs",
  description: "We're hiring a remote Senior React Engineer to help build our dashboard product.",
  apply_link: "https://remoteok.com/remote-jobs/remote-senior-react-engineer-nimbus-cloud-labs-1140002",
  location: { raw: "Berlin, Germany", display_name: "Berlin, Germany", city: null, state: null, country: null },
  tags: ["react", "javascript", "frontend", "full time"],
  salary: { min: 90000, max: 130000, currency: null, is_estimated: null },
  job_type: "unknown",
  is_remote: true,
  source_category: null,
  source: "remoteok",
  source_id: "1140002",
};
const remoteOkClassified = classifyJob(remoteOkExample);
console.log("  " + JSON.stringify({ ...remoteOkClassified, description: truncate(remoteOkClassified.description) }));
check("is_tech_relevant === true", remoteOkClassified.is_tech_relevant === true);
check("tech_relevance_source === keyword_heuristic (no Adzuna category available)", remoteOkClassified.tech_relevance_source === "keyword_heuristic");
check("experience_level === senior", remoteOkClassified.experience_level === "senior");
check("normalized_skills contains javascript and react", ["javascript", "react"].every((s) => remoteOkClassified.normalized_skills.includes(s)));
check("normalized_skills excludes non-curated tag 'frontend'", !remoteOkClassified.normalized_skills.includes("frontend"));
check("original fields preserved (company)", remoteOkClassified.company === "Nimbus Cloud Labs");
check("original fields preserved (is_remote)", remoteOkClassified.is_remote === true);

console.log("\n============================");
console.log(" DEFENSIVE / MALFORMED-INPUT TESTS (bonus, beyond the required 21)");
console.log("============================");

let malformedThrew = false;
try {
  classifyJob(null);
  classifyJob(undefined);
  classifyJob({});
  classifyTechRelevance(null);
  classifyExperienceLevel(null);
  deriveNormalizedSkills(null);
} catch (e) {
  malformedThrew = true;
}
check("no function throws on null/undefined/empty-object input", !malformedThrew);

const emptyResult = classifyJob({});
check("classifyJob({}) is_tech_relevant === null (nothing to search)", emptyResult.is_tech_relevant === null);
check("classifyJob({}) tech_relevance_source === unclassified", emptyResult.tech_relevance_source === "unclassified");
check("classifyJob({}) experience_level === unknown", emptyResult.experience_level === "unknown");
check("classifyJob({}) normalized_skills === []", Array.isArray(emptyResult.normalized_skills) && emptyResult.normalized_skills.length === 0);

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
console.log("\nNo live API calls were made and no MongoDB connection was attempted.");

if (failCount > 0) process.exitCode = 1;
