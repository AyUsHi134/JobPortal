// Deterministic, static verification for the Phase 2G-4 Job Detail
// display polish: the green theme reaching JobDetail.jsx/.scss, the
// new duplicate-Remote-location suppression (ported from JobCard's
// Phase 2G-2 rule), logical heading hierarchy, and router-based back
// navigation. The underlying field formatters themselves (formatLocation,
// formatSalary, formatExperience, etc.) are already covered by
// testJobDisplay.js and testJobDetails.js — not re-tested here, only
// their JobDetail-specific wiring where this phase actually changed it.
// Run via `node src/tests/testJobDetailDisplay.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
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
console.log(" JOB DETAIL DISPLAY — STATIC VERIFICATION TESTS (Phase 2G-4)");
console.log("============================");

const JOB_DETAIL = readSource("pages/JobDetail/JobDetail.jsx");
const JOB_DETAIL_SCSS = readSource("pages/JobDetail/JobDetail.scss");

// ---------------------------------------------------------------------------
console.log("\n[1] A confirmed-remote job never shows 'Remote' a second time as the location (item 7 — new for Job Detail this phase)");
{
  check("imports isDuplicateRemoteLocation from the shared jobDisplay.js util (not a reimplementation)", /isDuplicateRemoteLocation/.test(JOB_DETAIL) && /from ["'].*utils\/jobDisplay\.js["']/.test(JOB_DETAIL));
  check("isRemoteConfirmed is derived strictly from is_remote === true (tri-state honored, not truthy-coerced)", /const isRemoteConfirmed = job\.is_remote === true;/.test(JOB_DETAIL));
  check("locationText is nulled out via isDuplicateRemoteLocation before rendering", /isDuplicateRemoteLocation\(isRemoteConfirmed, rawLocationText\)/.test(JOB_DETAIL));
  check("the raw location is still computed through the shared formatLocation() first (never job.location directly)", /const rawLocationText = formatLocation\(job\.location\);/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Structured location is still never rendered as the raw object (item 6, re-verified after this phase's change)");
{
  check("job.location itself is never interpolated directly into JSX", !/\{job\.location\}/.test(JOB_DETAIL));
  check("the rendered location is always the formatted/derived text variable, not the raw field", /\{locationText &&/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Salary, experience, and skills are still never fabricated (items 8, 9, 10 — reusing the same unmodified shared formatters)");
{
  check("salary still goes through formatSalary(job.salary), never a hand-rolled figure", /formatSalary\(job\.salary\)/.test(JOB_DETAIL));
  check("experience still goes through formatExperience(job.experience_level)", /formatExperience\(job\.experience_level\)/.test(JOB_DETAIL));
  check("the salary line is still conditionally rendered (omitted entirely when null, never a fake $0)", /\{salaryText &&/.test(JOB_DETAIL));
  check("skills are still Array-guarded before rendering (no crash, no fabricated placeholder for a missing/malformed array)", /Array\.isArray\(job\.normalized_skills\)/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Description is still rendered safely, with no dangerouslySetInnerHTML and no new sanitizer dependency (item 11)");
{
  check("no dangerouslySetInnerHTML anywhere in JobDetail.jsx", !/dangerouslySetInnerHTML/.test(JOB_DETAIL));
  check("description still renders through the existing descriptionToParagraphs formatter", /descriptionToParagraphs\(job\.description\)/.test(JOB_DETAIL));
  check("no HTML-sanitizer dependency (e.g. DOMPurify, sanitize-html) was introduced", !/dompurify|sanitize-html/i.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Heading hierarchy is logical: one <h1> for the job title, <h2> for each body section, nothing skipped (accessibility item)");
{
  check("exactly one <h1> exists (the job title)", (JOB_DETAIL.match(/<h1\b/g) || []).length === 1);
  check("the <h1> is the job title", /<h1 className="job-title">\{job\.title\}<\/h1>/.test(JOB_DETAIL));
  check("body sections use <h2>, one level below the page's single <h1> (no <h3>+ used without an intervening <h2>)", /<h2>Skills<\/h2>/.test(JOB_DETAIL) && /<h2>Description<\/h2>/.test(JOB_DETAIL) && !/<h3\b/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Back navigation uses the existing router, never a history-dependent fallback that could break on a direct visit (item 8)");
{
  check("a real <Link to=\"/jobs\"> is used", /<Link to="\/jobs" className="back-to-listing">/.test(JOB_DETAIL));
  check("no navigate(-1)/window.history dependency exists anywhere in the file", !/navigate\(-1\)/.test(JOB_DETAIL) && !/window\.history/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[7] The existing Save behavior remains connected to the shared save-state architecture, unmodified logic-wise (item 18)");
{
  check("still imports the shared useSavedJobState hook", /import \{ useSavedJobState \} from ["'].*hooks\/useSavedJobState\.js["']/.test(JOB_DETAIL));
  check("still imports the shared getSaveButtonState util", /import \{ getSaveButtonState \} from ["'].*utils\/savedJobUi\.js["']/.test(JOB_DETAIL));
  check("still renders saveButton.label / uses saveButton.disabled (no hand-written replacement logic)", /\{saveButton\.label\}/.test(JOB_DETAIL) && /disabled=\{saveButton\.disabled\}/.test(JOB_DETAIL));
  check("the Save control now also exposes aria-pressed reflecting its state (a minimal, disclosed accessibility styling addition, not a logic change)", /aria-pressed=\{isSaved\}/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[8] The green theme reaches Job Detail — no leftover purple/lavender hex anywhere in JobDetail.scss");
{
  const KNOWN_PURPLE_HEXES = [
    "#7046d3", "#5f3dbf", "#ece4fa", "#faf7ff", "#2a223e", "#5f43b2", "#a596c9", "#ebe3fb",
    "#a276e8", "#8457e7", "#987fe7", "#563ba7", "#6d4cbe", "#51308d", "#7b59c6", "#f5f1fc",
    "#d7c7ff", "#bfe8cf", "#f7f3ff", "#4a4458", "#b3392f0",
  ];
  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => JOB_DETAIL_SCSS.toLowerCase().includes(hex));
  check("JobDetail.scss contains no old purple/lavender hex value", offenders.length === 0);
  check("JobDetail.scss reads its palette from the shared design tokens", /\$primary-color|\$primary-hover|\$accent-color|\$text-dark|\$text-muted|\$border-color|\$box-shadow/.test(JOB_DETAIL_SCSS));
  check("the disabled Apply state has its own distinct, honest styling (not visually identical to the working action)", /&--disabled\s*\{/.test(JOB_DETAIL_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[9] No horizontal-overflow-risk pattern was introduced; badges/actions wrap instead of forcing width (item 10 — responsiveness)");
{
  check(".job-badges wraps", /\.job-badges\s*\{[^}]*flex-wrap:\s*wrap/.test(JOB_DETAIL_SCSS));
  check(".job-actions wraps", /\.job-actions\s*\{[^}]*flex-wrap:\s*wrap/.test(JOB_DETAIL_SCSS));
  check("no bare fixed pixel width was introduced on the detail container (only a responsive max-width cap)", !/\.job-detail-container\s*\{[^}]*(?<!max-)\bwidth:\s*\d+px/.test(JOB_DETAIL_SCSS));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
