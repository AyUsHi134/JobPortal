// Curated, maintainable pattern/name sets for technology-relevance
// classification and skills extraction. Deliberately compact rather than
// an enormous arbitrary keyword list — see PHASE_1F_REPORT.md for the
// reasoning behind each list. Every entry here maps to a concrete,
// explainable reason a job would or would not be considered technical.

// Unambiguous non-technical role words. A title match here is only a
// hard exclusion if it does NOT also match a TECH_QUALIFIER_PATTERNS
// entry, so hybrid titles like "Sales Engineer" or "Technical Recruiter"
// are never wrongly excluded.
export const NON_TECH_TITLE_PATTERNS = [
  /\bsales\b/i,
  /\bmarketing\b/i,
  /\bhuman resources?\b/i,
  /\bhr\b/i,
  /\brecruiter\b/i,
  /\baccountant\b/i,
  /\bfinance\b/i,
  /\bnurse\b/i,
  /\bphysician\b/i,
  /\bhospitality\b/i,
  /\bchef\b/i,
  /\bwaiter\b|\bwaitress\b/i,
  /\bdriver\b/i,
  /\bcustomer service\b/i,
  /\boperations manager\b/i,
  /\bbusiness development\b/i,
];

// If any of these also appear in the title, a NON_TECH_TITLE_PATTERNS
// match is treated as ambiguous rather than excluded.
export const TECH_QUALIFIER_PATTERNS = [
  /\bdeveloper\b/i,
  /\bengineer\b/i,
  /\bprogrammer\b/i,
  /\barchitect\b/i,
  /\bdevops\b/i,
  /\bsde\b/i,
  /\bsoftware\b/i,
];

// Clear, unambiguous technical job-title patterns, mapped directly to
// PHASE_1F's own target role list (software/frontend/backend/full-stack
// developer, React/JS/Python/Java developer, QA/test engineer,
// DevOps/cloud engineer, data engineer/analyst, AI/ML engineer,
// cybersecurity, mobile developer, and close equivalents).
export const TECH_TITLE_PATTERNS = [
  /\bsoftware (developer|engineer)\b/i,
  /\bfront[- ]?end (developer|engineer)\b/i,
  /\bback[- ]?end (developer|engineer)\b/i,
  /\bfull[- ]?stack (developer|engineer)\b/i,
  /\breact (developer|engineer|\.?js)\b/i,
  /\bjavascript (developer|engineer)\b/i,
  /\bpython (developer|engineer)\b/i,
  /\bjava (developer|engineer)\b/i,
  /\b(qa|quality assurance|test) (engineer|analyst)\b/i,
  /\bdevops( engineer)?\b/i,
  /\bcloud (engineer|architect)\b/i,
  /\bdata engineer\b/i,
  /\bdata analyst\b/i,
  /\b(ai|ml|machine learning) engineer\b/i,
  /\bcybersecurity\b/i,
  /\bsecurity (engineer|analyst)\b/i,
  /\bmobile (developer|engineer)\b/i,
  /\b(ios|android) developer\b/i,
  /\bweb developer\b/i,
  /\bprogrammer\b/i,
  /\bsde\b/i,
];

// Specific, NAMED technologies only — never generic words like
// "technology", "computer", "digital", or "data" (explicitly excluded
// per PHASE_1F's instructions, and per the false positives Phase 1A
// already documented from broader keyword matching). Used both as
// supporting evidence for tech-relevance classification and as the
// allowlist for normalized_skills extraction.
export const TECH_SKILL_NAMES = [
  "javascript", "typescript", "python", "java", "react", "angular", "vue",
  "node.js", "node", "express", "django", "flask", "spring", "spring boot",
  "aws", "azure", "gcp", "kubernetes", "docker", "sql", "mongodb",
  "postgresql", "mysql", "redis", "graphql", "rest api", "git", "ci/cd",
  "machine learning", "tensorflow", "pytorch", "html", "css", "c++", "c#",
  "go", "golang", "rust", "swift", "kotlin", "php", "ruby",
];
