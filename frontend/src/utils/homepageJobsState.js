// Pure, framework-free pagination/guest-cap logic for the Phase 2G-3
// homepage "Recent Jobs" section. Kept side-effect-free (no React, no
// network) so the actual rules — dedupe on page-append, the 40-job guest
// cap, when "View More" may fire another request, and when the signup
// CTA is honestly earned — are directly unit-testable, mirroring the
// established pattern in utils/jobDiscoveryState.js. Home.jsx wires these
// to useState/useEffect and the real listJobs() service call but contains
// no branching logic of its own beyond calling these.

// A later UI pass explicitly requires exactly 9 job cards before "View
// More" (3 full rows of 3 on desktop, still 9 total on tablet/mobile at
// their own per-row counts) — this constant is the single source of truth
// for that count, driving both the initial fetch and every subsequent
// "View More" page size, so the requirement is met through the real
// fetch/render logic rather than a JSX-level slice or fabricated cards.
// 9 no longer divides GUEST_JOB_LIMIT evenly (unlike the previous page
// size of 8, which cleanly divided 40) — capJobsForGuest's own defensive
// slice below already handles that overshoot correctly regardless (see
// its own doc comment), so this is a harmless, expected side effect, not
// a bug.
export const HOMEPAGE_PAGE_SIZE = 9;
export const GUEST_JOB_LIMIT = 40;

/**
 * Appends only genuinely new jobs (by `_id`) — a defensive guard against a
 * job appearing twice across two page requests (e.g. a same-instant
 * `date_posted` tie shifting sort order between requests), per this
 * phase's explicit "avoid duplicate jobs when loading the next page"
 * requirement. Never reorders or drops an already-loaded job.
 */
export function mergeUniqueJobs(existingJobs, newJobs) {
  const seenIds = new Set(existingJobs.map((job) => job._id));
  const deduped = newJobs.filter((job) => !seenIds.has(job._id));
  return [...existingJobs, ...deduped];
}

/**
 * A logged-in user is never capped (per this phase's explicit "do not
 * impose the 40-job guest cap" on logged-in browsing). A guest's job list
 * is trimmed to the cap defensively — `HOMEPAGE_PAGE_SIZE` no longer
 * divides the cap evenly (9 vs. 40), so a guest's last "View More" page
 * can legitimately overshoot 40 before being trimmed here; nothing
 * upstream relies on clean divisibility, this slice is what actually
 * enforces the cap either way.
 */
export function capJobsForGuest(jobs, isAuthenticated, cap = GUEST_JOB_LIMIT) {
  if (isAuthenticated) return jobs;
  return jobs.length > cap ? jobs.slice(0, cap) : jobs;
}

/**
 * Decides whether "View More" may fire another request at all:
 *   1. The backend must actually have another page (`page < totalPages`)
 *      — never request past the last real page.
 *   2. A guest additionally stops once the cap is reached, so no
 *      unnecessary page request is ever made past 40 (this phase's
 *      explicit "do not request more pages than necessary").
 * A logged-in user only needs (1) — normal backend pagination continues
 * uncapped.
 */
export function canLoadMoreHomepageJobs({ jobsCount, pagination, isAuthenticated, cap = GUEST_JOB_LIMIT }) {
  const hasMoreBackendPages = Boolean(pagination) && pagination.page < pagination.totalPages;
  if (!hasMoreBackendPages) return false;
  if (isAuthenticated) return true;
  return jobsCount < cap;
}

/**
 * The guest signup wall is only ever earned, never fabricated: it shows
 * once a guest has reached the cap AND the backend confirms real jobs
 * exist beyond what's already loaded (`pagination.total > jobsCount`). A
 * dataset with fewer than `cap` total jobs never triggers it — a guest
 * who has already seen the entire dataset never sees a misleading
 * "there's more, sign up" prompt for jobs that don't exist.
 */
export function shouldShowGuestSignupCta({ jobsCount, pagination, isAuthenticated, cap = GUEST_JOB_LIMIT }) {
  if (isAuthenticated) return false;
  if (jobsCount < cap) return false;
  return Boolean(pagination) && pagination.total > jobsCount;
}
