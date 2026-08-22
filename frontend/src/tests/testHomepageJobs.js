// Deterministic verification for the Phase 2G-3 homepage "Recent Jobs"
// pagination/guest-cap logic: the pure utils/homepageJobsState.js
// functions, plus static checks that Home.jsx actually wires them
// correctly onto the centralized jobsApi service and real backend
// pagination metadata (never a bare-array assumption). Run via
// `node src/tests/testHomepageJobs.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HOMEPAGE_PAGE_SIZE,
  GUEST_JOB_LIMIT,
  mergeUniqueJobs,
  capJobsForGuest,
  canLoadMoreHomepageJobs,
  shouldShowGuestSignupCta,
} from "../utils/homepageJobsState.js";

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

function makeJobs(ids) {
  return ids.map((id) => ({ _id: id, title: `Job ${id}` }));
}

console.log("============================");
console.log(" HOMEPAGE JOBS / PAGINATION / GUEST CAP — DETERMINISTIC + STATIC TESTS (Phase 2G-3)");
console.log("============================");

// ---------------------------------------------------------------------------
// A later UI pass intentionally set HOMEPAGE_PAGE_SIZE to 9 (exactly 9
// Home job cards before "View More," 3 full rows of 3 on desktop) — this
// no longer divides GUEST_JOB_LIMIT (40) evenly the way the previous size
// of 8 did. Updated in place (same "revise the check, don't weaken it"
// convention every other intentional-change section in this project's
// test suite follows): the real, still-enforced invariant is that a guest
// NEVER sees more than 40 jobs regardless of how the page size divides,
// which is what this check now verifies directly against a realistic
// overshoot scenario, instead of requiring clean divisibility.
console.log("\n[1] HOMEPAGE_PAGE_SIZE is exactly 9 (the intentional 'exactly 9 cards before View More' requirement); a guest is still never handed more than GUEST_JOB_LIMIT even though 9 no longer divides it evenly");
{
  check("HOMEPAGE_PAGE_SIZE is exactly 9", HOMEPAGE_PAGE_SIZE === 9);
  const fifthPageOvershoot = makeJobs(Array.from({ length: HOMEPAGE_PAGE_SIZE * 5 }, (_, i) => String(i)));
  check(
    "even when 5 pages of 9 (45 jobs) overshoots the 40-job cap, capJobsForGuest still trims a guest to exactly 40",
    capJobsForGuest(fifthPageOvershoot, false).length === GUEST_JOB_LIMIT
  );
}

// ---------------------------------------------------------------------------
console.log("\n[2] mergeUniqueJobs — duplicate jobs are never added across page loads (item 10)");
{
  const existing = makeJobs(["a", "b", "c"]);
  const merged = mergeUniqueJobs(existing, makeJobs(["c", "d", "e"]));
  check("only genuinely new jobs are appended", merged.map((j) => j._id).join(",") === "a,b,c,d,e");
  check("no job id appears twice", new Set(merged.map((j) => j._id)).size === merged.length);
  check("already-loaded jobs are never reordered or dropped", merged[0]._id === "a" && merged[1]._id === "b" && merged[2]._id === "c");
  check("appending an entirely-fresh page with no overlap still works", mergeUniqueJobs(makeJobs(["a"]), makeJobs(["b"])).length === 2);
  check("appending an empty page is a no-op", mergeUniqueJobs(existing, []).length === 3);
}

// ---------------------------------------------------------------------------
console.log("\n[3] capJobsForGuest — a guest's visible jobs never exceed the 40-job cap; a logged-in user is never capped (items 11, 14)");
{
  const fortyFive = makeJobs(Array.from({ length: 45 }, (_, i) => String(i)));
  check("a guest's job list is trimmed to the cap", capJobsForGuest(fortyFive, false).length === 40);
  check("a logged-in user's job list is returned untouched, even past 40", capJobsForGuest(fortyFive, true).length === 45);
  check("a guest's job list under the cap is left untouched", capJobsForGuest(makeJobs(["a", "b"]), false).length === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[4] canLoadMoreHomepageJobs — the core View More / guest-cap decision (items 9, 11, 13, 14, 15)");
{
  const morePagesAvailable = { page: 1, limit: 8, total: 100, totalPages: 13 };
  const lastPage = { page: 5, limit: 8, total: 40, totalPages: 5 };

  check("more backend pages exist, guest under cap -> can load more", canLoadMoreHomepageJobs({ jobsCount: 8, pagination: morePagesAvailable, isAuthenticated: false }) === true);
  check("guest exactly AT the 40-job cap -> stops, even though more backend pages exist (item 11)", canLoadMoreHomepageJobs({ jobsCount: 40, pagination: morePagesAvailable, isAuthenticated: false }) === false);
  check("logged-in user AT/PAST the 40-job cap still continues (item 14 — no cap imposed)", canLoadMoreHomepageJobs({ jobsCount: 40, pagination: morePagesAvailable, isAuthenticated: true }) === true);
  check("no more backend pages -> stops regardless of auth state (page boundary respected)", canLoadMoreHomepageJobs({ jobsCount: 8, pagination: lastPage, isAuthenticated: true }) === false);
  check("no pagination metadata yet (still loading) -> safely false, never throws", canLoadMoreHomepageJobs({ jobsCount: 0, pagination: null, isAuthenticated: false }) === false);
  check(
    "fewer than 40 total jobs exist -> the guest naturally stops at the real last page, not the cap (item 15)",
    canLoadMoreHomepageJobs({ jobsCount: 25, pagination: { page: 4, limit: 8, total: 25, totalPages: 4 }, isAuthenticated: false }) === false
  );
}

// ---------------------------------------------------------------------------
console.log("\n[5] shouldShowGuestSignupCta — the signup wall is only ever earned, never fabricated (items 12, 15)");
{
  const moreExist = { page: 5, limit: 8, total: 100, totalPages: 13 };
  const exactlyForty = { page: 5, limit: 8, total: 40, totalPages: 5 };

  check("guest AT the cap with real jobs beyond it -> CTA shown (item 12)", shouldShowGuestSignupCta({ jobsCount: 40, pagination: moreExist, isAuthenticated: false }) === true);
  check("guest below the cap -> no CTA yet", shouldShowGuestSignupCta({ jobsCount: 24, pagination: moreExist, isAuthenticated: false }) === false);
  check("logged-in user -> CTA never shown, regardless of count", shouldShowGuestSignupCta({ jobsCount: 40, pagination: moreExist, isAuthenticated: true }) === false);
  check(
    "the total dataset has exactly 40 jobs (nothing beyond the cap) -> no misleading wall (item 15)",
    shouldShowGuestSignupCta({ jobsCount: 40, pagination: exactlyForty, isAuthenticated: false }) === false
  );
  check("no pagination metadata -> safely false, never throws", shouldShowGuestSignupCta({ jobsCount: 40, pagination: null, isAuthenticated: false }) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[6] Home.jsx wiring — job loading uses the centralized jobsApi service, never a direct fetch/axios call (item 7)");
{
  const home = readSource("pages/Home.jsx");
  check("imports listJobs from services/jobsApi.js", /import \{ listJobs \} from ["'].*services\/jobsApi\.js["']/.test(home));
  check("no direct fetch(...) call exists", !/\bfetch\(/.test(home));
  check("no direct axios usage exists", !/\baxios\b/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Home.jsx wiring — the backend's real {success, data, pagination} envelope is handled, never a bare-array assumption (item 8)");
{
  const home = readSource("pages/Home.jsx");
  check("the initial load destructures both jobs and pagination from listJobs()'s resolved value", /\.then\(\(\{ jobs: fetchedJobs, pagination: fetchedPagination \}\) =>/.test(home));
  check("pagination is kept in its own state, not discarded", /const \[pagination, setPagination\] = useState/.test(home));
  check("the initial request explicitly requests a bounded page/limit rather than relying on an implicit bare fetch", /listJobs\(\{ page: 1, limit: HOMEPAGE_PAGE_SIZE \}\)/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Home.jsx wiring — View More requests the next real backend page and merges/caps correctly (items 9, 10, 11, 13, 14)");
{
  const home = readSource("pages/Home.jsx");
  check("handleViewMore computes the next page as page + 1", /const nextPage = page \+ 1;/.test(home));
  check("handleViewMore calls listJobs with that next page and the same page size", /listJobs\(\{\s*page: nextPage,\s*limit: HOMEPAGE_PAGE_SIZE,?\s*\}\)/.test(home));
  check("new jobs are merged through mergeUniqueJobs (no duplicates) and capped through capJobsForGuest (no guest overrun)", /capJobsForGuest\(mergeUniqueJobs\(prev, fetchedJobs\), isAuthenticated\)/.test(home));
  check("the View More button itself is only rendered when canLoadMoreHomepageJobs says so (never shown past the cap/last page)", /\{canLoadMore &&/.test(home));
  check("clicking is also guarded at the handler level against firing while already in flight or when not allowed", /if \(loadingMore \|\| !canLoadMore\) return;/.test(home));
  check("isAuthenticated is read from the existing AuthContext via useAuth(), not reimplemented", /const \{ isAuthenticated \} = useAuth\(\);/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[9] Home.jsx wiring — loading/error/empty states are all handled (item 16)");
{
  const home = readSource("pages/Home.jsx");
  check("a loading state is shown", /status === "loading"/.test(home) && /Loading jobs/.test(home));
  check("an error state is shown with role=\"alert\"", /loadError &&[\s\S]{0,80}role="alert"/.test(home));
  check("an honest empty state (zero jobs, no error) is distinguished from the error state", /jobs\.length === 0 && !loadError/.test(home));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
