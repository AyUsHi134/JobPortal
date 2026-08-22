import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.js";
import { saveJob, isJobSaved } from "../services/userApi.js";
import { resolveSavedStateAfterSave } from "../utils/savedJobUi.js";

// Phase 2E: the saved-job state a single job card/detail view needs,
// factored out of JobCard.jsx (Phase 2C) into a shared hook so
// JobDetail.jsx (Phase 2D) can offer the identical Save action without
// duplicating the fetch/save logic. Both callers combine this with the
// pure utils/savedJobUi.js#getSaveButtonState for the actual label/
// enabled decision.
//
// Identity is always carried by the JWT the centralized apiClient
// attaches (services/api.js) — this hook never accepts or sends a
// client-supplied user id, matching userApi.js's own contract
// (BACKEND_API_CONTRACT.md §6, PHASE_1I4_REPORT.md).
export function useSavedJobState(jobId) {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Logging out (isAuthenticated -> false) — whether the user explicitly
  // logs out or a protected request comes back 401 and api.js's
  // interceptor clears stale auth (Phase 2B) — re-runs this effect and
  // resets `isSaved` to false immediately, so no stale "Saved" indicator
  // survives past the session that earned it.
  useEffect(() => {
    setError(null);
    if (!isAuthenticated) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    isJobSaved(jobId)
      .then((saved) => {
        if (!cancelled) setIsSaved(saved);
      })
      .catch(() => {
        // A failed check isn't worth surfacing proactively — the button
        // simply stays in its current (unsaved-looking) state; a direct
        // Save attempt reports its own failure if it also fails.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, jobId]);

  const save = async () => {
    if (!isAuthenticated || isSaved || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const savedJobIds = await saveJob(jobId);
      setIsSaved(resolveSavedStateAfterSave(jobId, savedJobIds));
    } catch (err) {
      setError(err.message || "Could not save this job right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return { isAuthenticated, isSaved, isSaving, error, save };
}
