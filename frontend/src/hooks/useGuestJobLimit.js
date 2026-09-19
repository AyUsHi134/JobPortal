import { useCallback, useState } from "react";

/** Tracks backend guest limit state */
export function useGuestJobLimit() {
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // Call with each response
  const recordJobsResponse = useCallback((response) => {
    setGuestLimitReached(Boolean(response?.guestLimitReached));
  }, []);

  return { guestLimitReached, recordJobsResponse };
}
