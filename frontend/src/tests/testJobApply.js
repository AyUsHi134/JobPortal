// Deterministic, static verification for the Phase 2G-4 Apply flow:
// JobCard -> View Details -> /job/:id -> Apply Now -> the real,
// backend-supplied apply_link, opened externally with no intermediate
// page, no fake internal application form, and no request ever sent to
// the JobPortal backend for "applying." Focused on what this phase
// actually changed/verified — the underlying apply_link/isValidApplyLink
// plumbing itself was already covered by testJobDetails.js [7] (Phase
// 2D) and is not re-duplicated here except where this phase's own
// requirements (single action, no URL construction, no redundant link,
// no fake form) need fresh coverage. Run via
// `node src/tests/testJobApply.js`.

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
console.log(" JOB APPLY FLOW — STATIC VERIFICATION TESTS (Phase 2G-4)");
console.log("============================");

const JOB_DETAIL = readSource("pages/JobDetail/JobDetail.jsx");
const APP_SOURCE = readSource("App.jsx");

// ---------------------------------------------------------------------------
console.log("\n[1] Exactly one primary application action exists, labeled 'Apply Now ↗' (items 4, 5, 16)");
{
  check("the visible label reads 'Apply Now ↗'", /Apply Now ↗/.test(JOB_DETAIL));
  check("the old combined 'Apply / View Original Job' label is gone", !/Apply \/ View Original Job/.test(JOB_DETAIL));
  check("no separate 'View Original' text/control exists anywhere on the page", !/View Original/i.test(JOB_DETAIL));
  check(
    "only the Apply action's own two mutually-exclusive branches (active link / disabled fallback) carry the 'apply-btn' class — no third, separate original-link control exists",
    (JOB_DETAIL.match(/className="apply-btn/g) || []).length === 2
  );
}

// ---------------------------------------------------------------------------
console.log("\n[2] Apply Now uses the real, backend-supplied apply_link verbatim — never constructed or modified (items 12, 13)");
{
  check("the href is job.apply_link itself, not a template/concatenation built from parts", /href=\{job\.apply_link\}/.test(JOB_DETAIL));
  check("no string concatenation or template literal builds a URL around apply_link (e.g. prefixing/suffixing it)", !/`\$\{job\.apply_link\}/.test(JOB_DETAIL) && !/job\.apply_link\s*\+/.test(JOB_DETAIL));
  check("apply_link's presence/validity is judged only through the existing isValidApplyLink formatter, not a hand-rolled check", /isValidApplyLink\(job\.apply_link\)/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Apply Now opens the original listing externally, with the correct security attributes (item 14)");
{
  check("target=\"_blank\" is set", /target="_blank"/.test(JOB_DETAIL));
  check("rel=\"noopener noreferrer\" is set (prevents the new tab from accessing window.opener, and never leaks a Referer)", /rel="noopener noreferrer"/.test(JOB_DETAIL));
  check("the accessible name explicitly says it opens in a new tab, for assistive-tech users who can't see the ↗ glyph", /aria-label=\{`Apply for[\s\S]{0,60}opens in a new tab/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[4] A missing/invalid apply_link produces a safe, honest, non-clickable state — never a fabricated URL or a dead-clicking link (item 15)");
{
  check("the fallback is a real <button>, not a styled-to-look-clickable <a href=\"#\"> or javascript:void(0)", /<button type="button" className="apply-btn apply-btn--disabled" disabled>/.test(JOB_DETAIL));
  check("the fallback uses the native disabled attribute (assistive tech correctly reports it as unavailable), not just a CSS class", /className="apply-btn apply-btn--disabled" disabled/.test(JOB_DETAIL));
  check("the fallback's label is honest and specific", /Application link unavailable/.test(JOB_DETAIL));
  check("the fallback branch never invents a URL to open (no href/window.open in that branch)", !/apply-btn--disabled[\s\S]{0,120}href/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[5] No intermediate application page and no internal fake application form were created");
{
  check("JobDetail.jsx renders no <form> of its own for applying", !/<form/i.test(JOB_DETAIL));
  const registeredPaths = APP_SOURCE.match(/path="[^"]*"/g) || [];
  check("App.jsx registers no new apply-related route (e.g. /apply, /job/:id/apply)", !registeredPaths.some((p) => /apply/i.test(p)));
  check("App.jsx still registers exactly one Job Detail route", (APP_SOURCE.match(/path="\/job\/:id"/g) || []).length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[6] No request is ever sent to the JobPortal backend for 'applying' — Apply Now only ever navigates the browser to the external URL");
{
  check("JobDetail.jsx contains no apply-related service/API call (no applyToJob/submitApplication/postApplication-shaped identifier)", !/applyToJob|submitApplication|postApplication/i.test(JOB_DETAIL));
  check("JobDetail.jsx imports no additional service beyond the existing saved-job hook/util (no new API surface introduced for Apply)", !/from ["']\.\.\/\.\.\/services\//.test(JOB_DETAIL));
  check("no direct fetch(...) call exists", !/\bfetch\(/.test(JOB_DETAIL));
  check("no direct axios usage exists", !/\baxios\b/.test(JOB_DETAIL));
}

// ---------------------------------------------------------------------------
console.log("\n[7] No Adzuna/RemoteOK call pattern was introduced by this phase's Apply-flow changes (item 20)");
{
  const HOSTNAME_PATTERN = /adzuna\.(com|in)|remoteok\.(com|io)|api\.adzuna/i;
  check("JobDetail.jsx contains no Adzuna/RemoteOK hostname reference", !HOSTNAME_PATTERN.test(JOB_DETAIL));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
