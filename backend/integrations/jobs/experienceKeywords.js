// Title patterns broader than description

export const TITLE_SENIOR_PATTERNS = [
  /\bsenior\b/i,
  /\bsr\.?\b/i,
  /\blead\b/i,
  /\bprincipal\b/i,
  /\bstaff\b/i,
  /\barchitect\b/i,
  /\bmanager\b/i,
  /\bdirector\b/i,
  /\bhead\b/i,
];
// Description senior words restricted
export const DESCRIPTION_SENIOR_PATTERNS = [/\bsenior\b/i, /\bsr\.?\b/i];

export const TITLE_JUNIOR_PATTERNS = [/\bjunior\b/i, /\bjr\.?\b/i];
export const DESCRIPTION_JUNIOR_PATTERNS = [/\bjunior\b/i];

// Graduate allowed only in title
export const TITLE_FRESHER_PATTERNS = [
  /\bfresher\b/i,
  /\bfresh graduate\b/i,
  /\brecent graduate\b/i,
  /\bnew graduate\b/i,
  /\bgraduate\b/i,
];
export const DESCRIPTION_FRESHER_PATTERNS = [
  /\bfresher\b/i,
  /\bfresh graduate\b/i,
  /\brecent graduate\b/i,
  /\bnew graduate\b/i,
];

// Entry-level shared by both
export const ENTRY_PATTERNS = [/\bentry[- ]?level\b/i];
