// Deterministic verification for frontend/src/utils/jobDisplay.js
// (Phase 2C): the pure formatting functions JobCard.jsx (and, in a later
// phase, JobDetail.jsx) use to render a public Job object honestly —
// never fabricating a value for missing/null/unknown data. No React
// rendering is involved (no test-rendering library is installed); since
// JobCard's rendering is a direct, unconditional pass-through of these
// functions' return values into JSX, testing the functions IS testing
// the actual rendering decision, not a reimplementation of it — see
// PHASE_2C_REPORT.md §10 for the full reasoning. Run via
// `node src/tests/testJobDisplay.js`.

import {
  formatLocation,
  formatSalary,
  formatExperience,
  formatRemote,
  formatTechRelevance,
  formatSource,
  formatDatePosted,
  isValidApplyLink,
} from "../utils/jobDisplay.js";

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}

console.log("============================");
console.log(" JOB DISPLAY FORMATTING — DETERMINISTIC TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] formatLocation — structured location renders correctly, never the raw object");
{
  check("null location -> null (never rendered)", formatLocation(null) === null);
  check("missing location -> null", formatLocation(undefined) === null);

  check(
    "display_name is preferred when present",
    formatLocation({ raw: "x", display_name: "Pune, Maharashtra", city: "Pune", state: "Maharashtra", country: "India" }) === "Pune, Maharashtra"
  );

  check(
    "falls back to joined city/state/country when display_name is absent",
    formatLocation({ raw: "x", display_name: null, city: "Bangalore", state: "Karnataka", country: "India" }) === "Bangalore, Karnataka, India"
  );

  check(
    "joined fallback skips null pieces (RemoteOK-shaped partial data)",
    formatLocation({ raw: "x", display_name: null, city: null, state: null, country: "India" }) === "India"
  );

  check(
    "falls back to raw when nothing structured is available at all (typical RemoteOK job)",
    formatLocation({ raw: "Worldwide", display_name: null, city: null, state: null, country: null }) === "Worldwide"
  );

  check("never returns the raw object itself (would render as [object Object])", typeof formatLocation({ raw: "x" }) !== "object");
}

// ---------------------------------------------------------------------------
console.log("\n[2] formatSalary — never fabricates a zero/placeholder salary");
{
  check("null salary -> null", formatSalary(null) === null);
  check("missing salary -> null", formatSalary(undefined) === null);
  check(
    "salary object present but both min and max null -> null (the common real-data case)",
    formatSalary({ min: null, max: null, currency: null, is_estimated: null }) === null
  );
  check("the word '0' or '$0' never appears for an unavailable salary", !String(formatSalary({ min: null, max: null })).includes("0"));
}

console.log("\n[3] formatSalary — min/max/currency/estimated combinations render correctly");
{
  check("min + max, no currency", formatSalary({ min: 800000, max: 1200000, currency: null, is_estimated: null }) === "800,000 – 1,200,000");
  check("min + max + currency", formatSalary({ min: 50000, max: 70000, currency: "USD", is_estimated: null }) === "USD 50,000 – 70,000");
  check("min only -> open-ended '+' phrasing", formatSalary({ min: 900000, max: null, currency: "INR", is_estimated: null }) === "INR 900,000+");
  check("max only -> 'Up to' phrasing", formatSalary({ min: null, max: 500000, currency: "INR", is_estimated: null }) === "Up to INR 500,000");
  check(
    "is_estimated appends '(estimated)' without altering the figures",
    formatSalary({ min: 100000, max: 150000, currency: "INR", is_estimated: true }) === "INR 100,000 – 150,000 (estimated)"
  );
  check(
    "is_estimated: false does NOT append the estimated label",
    !formatSalary({ min: 100000, max: 150000, currency: "INR", is_estimated: false }).includes("estimated")
  );
}

// ---------------------------------------------------------------------------
console.log("\n[4] formatExperience — unknown/unrecognized never renders as a confirmed level");
{
  check("fresher renders", formatExperience("fresher") === "Fresher");
  check("entry renders", formatExperience("entry") === "Entry Level");
  check("junior renders", formatExperience("junior") === "Junior");
  check("mid renders", formatExperience("mid") === "Mid Level");
  check("senior renders", formatExperience("senior") === "Senior");
  check("'unknown' -> null, never displayed as though it were a real level", formatExperience("unknown") === null);
  check("missing/undefined -> null", formatExperience(undefined) === null);
  check("an unrecognized/garbage value -> null (never passed through blindly)", formatExperience("not-a-real-level") === null);
}

// ---------------------------------------------------------------------------
console.log("\n[5] formatRemote — true/false/null are distinguished, unknown is never treated as remote");
{
  check("true -> 'Remote'", formatRemote(true) === "Remote");
  check("false -> 'On-site' (a real confirmed non-remote signal, not omitted)", formatRemote(false) === "On-site");
  check("null -> null (unknown, never assumed remote)", formatRemote(null) === null);
  check("undefined -> null", formatRemote(undefined) === null);
}

// ---------------------------------------------------------------------------
console.log("\n[6] formatTechRelevance — true/false/unknown handled without conflating false and unknown");
{
  check("true -> 'Tech'", formatTechRelevance(true) === "Tech");
  check("false -> null (never a fabricated 'Non-Tech' assertion in the compact card)", formatTechRelevance(false) === null);
  check("null (unknown) -> null", formatTechRelevance(null) === null);
  check("false and null produce the IDENTICAL (absent) UI signal — never conflated with a false being mislabeled as unknown or vice versa", formatTechRelevance(false) === formatTechRelevance(null));
}

// ---------------------------------------------------------------------------
console.log("\n[7] formatSource — only recognized sources are labeled");
{
  check("adzuna -> 'Adzuna'", formatSource("adzuna") === "Adzuna");
  check("remoteok -> 'RemoteOK'", formatSource("remoteok") === "RemoteOK");
  check("'manual' -> null (not useful to surface)", formatSource("manual") === null);
  check("missing -> null", formatSource(undefined) === null);
}

// ---------------------------------------------------------------------------
console.log("\n[8] formatDatePosted — relative phrasing, deterministic given a fixed 'now'");
{
  const now = Date.now();
  check("posted just now -> 'Posted today'", formatDatePosted(new Date(now).toISOString(), now) === "Posted today");
  check("posted 1 day ago -> singular phrasing", formatDatePosted(new Date(now - 1 * 86400000).toISOString(), now) === "Posted 1 day ago");
  check("posted 5 days ago -> plural phrasing", formatDatePosted(new Date(now - 5 * 86400000).toISOString(), now) === "Posted 5 days ago");
  check("posted 40 days ago -> falls back to a real date, not '40 days ago'", formatDatePosted(new Date(now - 40 * 86400000).toISOString(), now).startsWith("Posted ") && !formatDatePosted(new Date(now - 40 * 86400000).toISOString(), now).includes("days ago"));
  check("missing date -> null", formatDatePosted(null) === null);
  check("invalid date string -> null, not 'Invalid Date'", formatDatePosted("not-a-date", now) === null);
}

// ---------------------------------------------------------------------------
console.log("\n[9] isValidApplyLink — only real http(s) links are treated as usable");
{
  check("a real https link is valid", isValidApplyLink("https://example.com/job/123") === true);
  check("a real http link is valid", isValidApplyLink("http://example.com/job/123") === true);
  check("missing apply_link -> false (handled safely, not fabricated)", isValidApplyLink(undefined) === false);
  check("empty string -> false", isValidApplyLink("") === false);
  check("a non-URL string -> false", isValidApplyLink("not a link") === false);
  check("a non-string value -> false, never throws", isValidApplyLink(12345) === false);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
