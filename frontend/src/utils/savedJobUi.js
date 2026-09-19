// Pure Save button logic

/**
 * @param {{isAuthenticated: boolean, isSaved: boolean, isSaving: boolean}} state
 * @returns {{label: string, disabled: boolean, action: "login"|"save"|"none"}}
 */
export function getSaveButtonState({ isAuthenticated, isSaved, isSaving }) {
  if (!isAuthenticated) {
    // Login prompt, not failing request
    return { label: "Log in to Save", disabled: false, action: "login" };
  }
  if (isSaving) {
    // Disabled while saving
    return { label: "Saving...", disabled: true, action: "none" };
  }
  if (isSaved) {
    // Enabled; unsave supported
    return { label: "Saved", disabled: false, action: "unsave" };
  }
  return { label: "Save", disabled: false, action: "save" };
}

/** Trusts backend saved list */
export function resolveSavedStateAfterSave(jobId, savedJobIds) {
  return Array.isArray(savedJobIds) ? savedJobIds.includes(jobId) : true;
}

/** Trusts backend after unsave */
export function resolveSavedStateAfterUnsave(jobId, savedJobIds) {
  return Array.isArray(savedJobIds) ? savedJobIds.includes(jobId) : false;
}
