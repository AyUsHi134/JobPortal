import { useCallback, useState } from "react";

/**
 * Tracks the backend-enforced guest job-view limit. GET /api/jobs now
 * returns `guestLimitReached` (jobsApi.js's listJobs already surfaces it
 * alongside `jobs`/`pagination`), computed server-side from the httpOnly
 * `guestId` cookie (backend/controllers/jobs.js) — always `false` for an
 * authenticated request. This hook just holds the most recently observed
 * value as React state; it never fetches on its own, replacing the old
 * purely client-side 40-job cap (utils/homepageJobsState.js).
 */
export function useGuestJobLimit() {
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // Call with each GET /api/jobs response (whatever listJobs() resolved
  // to) as it arrives.
  const recordJobsResponse = useCallback((response) => {
    setGuestLimitReached(Boolean(response?.guestLimitReached));
  }, []);

  return { guestLimitReached, recordJobsResponse };
}
