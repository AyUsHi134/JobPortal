// Homepage jobs logic verification

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HOMEPAGE_PAGE_SIZE,
  mergeUniqueJobs,
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

// Page size 9 revision
console.log("\n[1] HOMEPAGE_PAGE_SIZE is exactly 9 (the intentional 'exactly 9 cards before View More' requirement)");
{
  check("HOMEPAGE_PAGE_SIZE is exactly 9", HOMEPAGE_PAGE_SIZE === 9);
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
  check("the initial load reads both jobs and pagination from listJobs()'s resolved response", /\.then\(\(response\) => \{[\s\S]*?setJobs\(response\.jobs\);[\s\S]*?setPagination\(response\.pagination\);/.test(home));
  check("pagination is kept in its own state, not discarded", /const \[pagination, setPagination\] = useState/.test(home));
  check("the initial request explicitly requests a bounded page/limit rather than relying on an implicit bare fetch", /listJobs\(\{ page: 1, limit: HOMEPAGE_PAGE_SIZE \}\)/.test(home));
  check("the initial response is also handed to recordJobsResponse, so guestLimitReached is tracked from page 1 on", /setStatus\("success"\);\s*recordJobsResponse\(response\);/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Home.jsx wiring — View More requests the next real backend page and merges/caps correctly (items 9, 10, 11, 13, 14)");
{
  const home = readSource("pages/Home.jsx");
  check("handleViewMore computes the next page as page + 1", /const nextPage = page \+ 1;/.test(home));
  check("handleViewMore calls listJobs with that next page and the same page size", /listJobs\(\{\s*page: nextPage,\s*limit: HOMEPAGE_PAGE_SIZE,?\s*\}\)/.test(home));
  check("new jobs are merged through mergeUniqueJobs (no duplicates); the old client-side 40-job cap (capJobsForGuest) is no longer called — the backend's guestLimitReached flag is the sole authority now", /mergeUniqueJobs\(prev, response\.jobs\)/.test(home) && !/capJobsForGuest\(/.test(home));
  check("the View More button is only rendered when there's a further backend page AND the guest limit hasn't been reached (canLoadMoreHomepageJobs is gone — canLoadMore is derived inline from pagination + guestLimitReached)", /\{canLoadMore &&/.test(home) && /pagination\.page < pagination\.totalPages && !guestLimitReached/.test(home));
  // Synchronous ref guard
  check("clicking is guarded by a synchronous ref (not just state), so a second rapid invocation sees it already set and never dispatches a second request (item A)", /const isFetchingMoreRef = useRef\(false\);/.test(home) && /if \(isFetchingMoreRef\.current \|\| !canLoadMore\) return;/.test(home));
  check("the ref is set to true synchronously, before listJobs is ever called — not after an await", (() => {
    const handlerMatch = home.match(/const handleViewMore = async \(\) => \{[\s\S]*?\n {2}\};/);
    if (!handlerMatch) return false;
    const body = handlerMatch[0];
    const guardIdx = body.indexOf("isFetchingMoreRef.current = true;");
    const dispatchIdx = body.indexOf("await listJobs(");
    return guardIdx !== -1 && dispatchIdx !== -1 && guardIdx < dispatchIdx;
  })());
  check("the ref is reset in a finally block, so a later click after completion/failure is never permanently blocked", /finally \{\s*setLoadingMore\(false\);\s*isFetchingMoreRef\.current = false;\s*\}/.test(home));
  check("each View More response is handed to recordJobsResponse, keeping guestLimitReached current", /recordJobsResponse\(response\);/.test(home));
  check("guest-limit state now comes from the shared useGuestJobLimit hook, not a reimplemented client-side auth/cap check", /const \{ guestLimitReached, recordJobsResponse \} = useGuestJobLimit\(\);/.test(home) && !/useAuth\(\)/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[9] Home.jsx wiring — loading/error/empty states are all handled (item 16)");
{
  const home = readSource("pages/Home.jsx");
  check("a loading state is shown", /status === "loading"/.test(home) && /Loading jobs/.test(home));
  check("an error state is shown with role=\"alert\"", /loadError &&[\s\S]{0,80}role="alert"/.test(home));
  check("an honest empty state (zero jobs, no error) is distinguished from the error state", /jobs\.length === 0 && !loadError/.test(home));
}

// Failed View More checks
console.log("\n[10] Home.jsx wiring — a failed View More preserves the existing job list and never advances pagination (items C, D)");
{
  const home = readSource("pages/Home.jsx");
  const handlerMatch = home.match(/const handleViewMore = async \(\) => \{[\s\S]*?\n {2}\};/);
  const handlerBody = handlerMatch ? handlerMatch[0] : "";
  const tryMatch = handlerBody.match(/try \{([\s\S]*?)\}\s*catch/);
  const catchMatch = handlerBody.match(/catch \(err\) \{([\s\S]*?)\}\s*finally/);
  const tryBody = tryMatch ? tryMatch[1] : "";
  const catchBody = catchMatch ? catchMatch[1] : "";

  check("View More has its own error state, separate from the initial-load loadError", /const \[viewMoreError, setViewMoreError\] = useState\(null\);/.test(home));
  check("a View More failure sets viewMoreError, never loadError", /setViewMoreError\(err\.message \|\| "Failed to load more jobs\."\);/.test(catchBody) && !/setLoadError/.test(catchBody));
  check("setJobs is only called on the success path — a failed request never touches (or clears) the already-loaded job list", /setJobs\(/.test(tryBody) && !/setJobs\(/.test(catchBody));
  check("setPage is only called on the success path — a failed request never advances the page number, so a retry requests the correct next page", /setPage\(nextPage\)/.test(tryBody) && !/setPage\(/.test(catchBody));
  check("the View More error is rendered near the button, not in place of the job grid (the grid's own condition is untouched)", /\{jobs\.length > 0 && \(/.test(home) && /\{viewMoreError && \(/.test(home));
  check("the View More button itself is not hidden by a view-more error — canLoadMore (unrelated to viewMoreError) still controls it, so the user can retry", /\{canLoadMore && \(/.test(home));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
