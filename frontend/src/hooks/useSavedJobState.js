import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.js";
import { saveJob, isJobSaved, unsaveJob } from "../services/userApi.js";
import { resolveSavedStateAfterSave, resolveSavedStateAfterUnsave } from "../utils/savedJobUi.js";

// Shared saved-job state hook
export function useSavedJobState(jobId) {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset saved state on logout
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
        // Failed check stays silent
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

  // Returns true if actually unsaved
  const unsave = async () => {
    if (!isAuthenticated || !isSaved || isSaving) return false;
    setIsSaving(true);
    setError(null);
    try {
      const savedJobIds = await unsaveJob(jobId);
      const stillSaved = resolveSavedStateAfterUnsave(jobId, savedJobIds);
      setIsSaved(stillSaved);
      return !stillSaved;
    } catch (err) {
      setError(err.message || "Could not unsave this job right now. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { isAuthenticated, isSaved, isSaving, error, save, unsave };
}
