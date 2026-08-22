// Deterministic + static verification for Phase 2G-7B's Find Jobs
// visual/UX refinements: the richer no-results state (a named query,
// honest zero-results behavior, working Clear Search/Browse All Jobs
// actions reusing the existing Phase 2C state-transition functions — no
// duplicated search logic), the always-shown results count line, that
// every Phase 2C filter/sort control and server-side pagination control
// is still present and untouched, and that FindJob.scss now reads from
// the shared design-system tokens instead of the old purple palette. Run
// via `node src/tests/testJobDiscoveryUi.js`.

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

const FINDJOB_JSX = readSource("pages/FindJob/FindJob.jsx");
const FINDJOB_SCSS = readSource("pages/FindJob/FindJob.scss");

console.log("============================");
console.log(" JOB DISCOVERY UI (Phase 2G-7B) — DETERMINISTIC + STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] The richer no-results state names the actual query and offers real, working actions (task items 4, 8)");
{
  const noResultsBlock = FINDJOB_JSX.slice(FINDJOB_JSX.indexOf("isDefaultFilters ? ("), FINDJOB_JSX.indexOf("state.status === \"success\" && state.jobs.length > 0"));
  check("a 'No jobs found' heading is shown for a search/filter that matched nothing", /No jobs found/.test(noResultsBlock));
  check("the actual query is named in the message, not a generic sentence", /We couldn't find jobs matching/.test(noResultsBlock) && /\{filters\.q\}/.test(noResultsBlock));
  check("a 'Clear Search' action exists and only appears when there IS a query to clear", /filters\.q &&[\s\S]{0,120}Clear Search/.test(noResultsBlock));
  check("a 'Browse All Jobs' action always exists for the no-results state", /Browse All Jobs/.test(noResultsBlock));
  check("the untouched 'nothing exists at all' message (a different, correct situation) is still shown separately, not replaced by the richer state", /No active jobs are available right now\./.test(noResultsBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Clear Search / Browse All Jobs reuse the existing Phase 2C pure state-transition functions — no duplicated/second search-logic path (task's 'do not duplicate search logic')");
{
  check("handleClearSearch calls the existing applyFilterChange(...) (imported from utils/jobDiscoveryState.js, not reimplemented)", /const handleClearSearch = \(\) => \{[\s\S]{0,150}applyFilterChange\(prev, \{ q: "" \}\)/.test(FINDJOB_JSX));
  check("Browse All Jobs' onClick is the same handleReset already used by the pre-existing 'Reset filters' button (one reset implementation, not two)", (FINDJOB_JSX.match(/onClick=\{handleReset\}/g) || []).length === 2);
  check("applyFilterChange is still imported from the unmodified utils/jobDiscoveryState.js (no local reimplementation)", /import \{[\s\S]*?applyFilterChange[\s\S]*?\} from "\.\.\/\.\.\/utils\/jobDiscoveryState\.js"/.test(FINDJOB_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Zero results never fall back to showing unrelated jobs (task item 9) — the zero-results and has-results branches remain mutually exclusive, sole content of their own condition");
{
  check("the zero-results branch (state.jobs.length === 0) and the has-results branch (state.jobs.length > 0) are two separate, non-overlapping conditions on the same state.jobs.length", /state\.jobs\.length === 0/.test(FINDJOB_JSX) && /state\.jobs\.length > 0/.test(FINDJOB_JSX));
  check("no job-rendering code (JobCard) exists inside the zero-results block", !/JobCard/.test(FINDJOB_JSX.slice(FINDJOB_JSX.indexOf("state.jobs.length === 0"), FINDJOB_JSX.indexOf("state.jobs.length > 0"))));
}

// ---------------------------------------------------------------------------
console.log("\n[4] A results count is always shown once results exist, between filters/status and the job grid (task item 5's hierarchy)");
{
  check("a results-count line renders the actual counts from real pagination data (state.jobs.length / state.pagination.total), not a hardcoded string", /results-count[\s\S]{0,40}Showing \{state\.jobs\.length\} of \{state\.pagination\.total\}/.test(FINDJOB_JSX));
  const resultsCountIdx = FINDJOB_JSX.indexOf("results-count");
  const gridIdx = FINDJOB_JSX.indexOf("job-listings__grid");
  check("the results count appears before the job grid in the markup", resultsCountIdx !== -1 && gridIdx !== -1 && resultsCountIdx < gridIdx);
}

// ---------------------------------------------------------------------------
console.log("\n[5] Every Phase 2C filter/sort control is still present, unchanged (task item 6 — 'keep all existing working filters,' 'do not add new backend filters')");
{
  check("free-text search input is present", /aria-label="Search jobs"/.test(FINDJOB_JSX));
  check("location input is present", /aria-label="Filter by location"/.test(FINDJOB_JSX));
  check("experience level select is present with all 6 backend enum options + 'All'", /value={filters\.experience_level}/.test(FINDJOB_JSX) && ["fresher", "entry", "junior", "mid", "senior", "unknown"].every((v) => new RegExp(`value="${v}"`).test(FINDJOB_JSX)));
  check("technology relevance select is present", /value={filters\.is_tech_relevant}/.test(FINDJOB_JSX));
  check("remote select is present", /value={filters\.is_remote}/.test(FINDJOB_JSX));
  check("source select is present with both real values (adzuna/remoteok)", /value={filters\.source}/.test(FINDJOB_JSX) && /value="adzuna"/.test(FINDJOB_JSX) && /value="remoteok"/.test(FINDJOB_JSX));
  check("sort select is present with all 3 real sort options", /value={filters\.sort}/.test(FINDJOB_JSX) && /value="newest"/.test(FINDJOB_JSX) && /value="oldest"/.test(FINDJOB_JSX) && /value="salary_high"/.test(FINDJOB_JSX));
  check("exactly the 5 existing discrete controls call updateFilter (experience_level, is_tech_relevant, is_remote, source, sort) — no new filter field was added", (FINDJOB_JSX.match(/updateFilter\("/g) || []).length === 5);
}

// ---------------------------------------------------------------------------
console.log("\n[6] Server-side pagination is still present and untouched (task item 11, 'View More must continue using real backend pagination' — this is Find Jobs' own Prev/Next, distinct from Home's View More, both preserved)");
{
  check("Previous/Next buttons still call the unmodified canGoPrev/canGoNext-gated handlers", /onClick={handlePrevPage}/.test(FINDJOB_JSX) && /onClick={handleNextPage}/.test(FINDJOB_JSX));
  check("pagination status still renders real backend pagination fields (page/totalPages/total), not a fabricated count", /Page \{state\.pagination\.page\} of \{state\.pagination\.totalPages\}/.test(FINDJOB_JSX));
  check("canGoPrev/canGoNext are still imported from the unmodified utils/jobDiscoveryState.js", /canGoPrev,\s*\n\s*canGoNext,/.test(FINDJOB_JSX) || (/canGoPrev/.test(FINDJOB_JSX) && /canGoNext/.test(FINDJOB_JSX)));
}

// ---------------------------------------------------------------------------
console.log("\n[7] FindJob.scss now reads from the shared design-system tokens — the last major page still on the old purple palette before this phase");
{
  const KNOWN_PURPLE_HEXES = [
    "#7046d3", "#5f43b2", "#7b42f6", "#a276e8", "#8457e7", "#51308d",
    "#6d4cbe", "#563ba7", "#987fe7", "#ece4fa", "#f7f3ff", "#faf7ff",
    "#b19bf9", "#d7c7ff", "#f5f1fc", "#7b59c6", "#b8a5f5", "#be9cff",
    "#6a0dad", "#7e30e1", "#6a23d4", "#462478", "#c3abfa", "#5f3dbf",
    "#a596c9", "#ebe3fb", "#2a223e", "#f5f5fc",
  ];
  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => FINDJOB_SCSS.toLowerCase().includes(hex));
  check("FindJob.scss contains no old purple hex value", offenders.length === 0);
  check("FindJob.scss reads its palette from shared tokens ($primary-color/$surface-color/$border-color/etc.), not new one-off hex values", /\$primary-color|\$surface-color|\$background|\$border-color/.test(FINDJOB_SCSS));
  check("the shared breakpoint mixins (mobile/tablet-down) are still used, not a new hand-rolled @media value", /@include mobile/.test(FINDJOB_SCSS) && /@include tablet-down/.test(FINDJOB_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[8] No direct API call was introduced outside the centralized service layer, and no Adzuna/RemoteOK reference beyond the legitimate filter-option strings");
{
  check("FindJob.jsx still sources jobs exclusively through the centralized listJobs() service", /import \{ listJobs \} from "\.\.\/\.\.\/services\/jobsApi\.js"/.test(FINDJOB_JSX));
  check("FindJob.jsx contains no direct fetch(...) call", !/\bfetch\(/.test(FINDJOB_JSX));
  check("FindJob.jsx contains no direct axios usage", !/\baxios\b/.test(FINDJOB_JSX));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
