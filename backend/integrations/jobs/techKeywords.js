// Curated tech keyword sets

// Non-tech role words
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

// Tech qualifiers keep hybrid titles
export const TECH_QUALIFIER_PATTERNS = [
  /\bdeveloper\b/i,
  /\bengineer\b/i,
  /\bprogrammer\b/i,
  /\barchitect\b/i,
  /\bdevops\b/i,
  /\bsde\b/i,
  /\bsoftware\b/i,
];

// Clear technical job-title patterns
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

// Named technologies only
export const TECH_SKILL_NAMES = [
  "javascript", "typescript", "python", "java", "react", "angular", "vue",
  "node.js", "node", "express", "django", "flask", "spring", "spring boot",
  "aws", "azure", "gcp", "kubernetes", "docker", "sql", "mongodb",
  "postgresql", "mysql", "redis", "graphql", "rest api", "git", "ci/cd",
  "machine learning", "tensorflow", "pytorch", "html", "css", "c++", "c#",
  "go", "golang", "rust", "swift", "kotlin", "php", "ruby",
];
