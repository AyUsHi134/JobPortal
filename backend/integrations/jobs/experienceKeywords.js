// Experience-level pattern sets. TITLE checks use the full pattern set;
// DESCRIPTION checks are deliberately more restrictive — a title is a
// short, deliberate labeling choice, while a long description can
// mention words like "manager" or "graduate" incidentally without that
// describing the role itself (e.g. "reports to the engineering manager",
// "great role for graduates and experienced professionals alike"). See
// PHASE_1F_REPORT.md §4 for the full precedence reasoning.

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
// Description senior signals are restricted to the two least-ambiguous
// words — the more generic senior-role nouns (manager/director/head/
// lead/staff/principal/architect) are excluded here since they are far
// more likely to appear incidentally in a long description.
export const DESCRIPTION_SENIOR_PATTERNS = [/\bsenior\b/i, /\bsr\.?\b/i];

export const TITLE_JUNIOR_PATTERNS = [/\bjunior\b/i, /\bjr\.?\b/i];
export const DESCRIPTION_JUNIOR_PATTERNS = [/\bjunior\b/i];

// Bare "graduate" is allowed in the TITLE (a title like "Graduate
// Software Engineer" is a deliberate, clear labeling choice) but
// deliberately excluded from the DESCRIPTION set — this is the exact
// scenario PHASE_1F's instructions warn about ("a title containing
// Senior should not become fresher merely because the description
// mentions graduates").
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

// Same pattern used for both title and description — "entry level" /
// "entry-level" is already a specific, deliberate two-word phrase with
// little risk of incidental appearance.
export const ENTRY_PATTERNS = [/\bentry[- ]?level\b/i];
