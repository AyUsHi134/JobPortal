// Deterministic verification for the Phase 2G-2 JobCard metadata rules:
// the trailing-comma location fix, the badge-specific "confirmed remote
// only" signal, and the "don't show Remote twice" location-suppression
// decision. These are the new/changed pure functions in
// utils/jobDisplay.js this phase introduced or fixed — no React
// rendering, no network, mirroring the existing testJobDisplay.js /
// testSavedJobUi.js convention. Run via
// `node src/tests/testJobCardMetadata.js`.

import {
  formatLocation,
  formatRemoteBadge,
  isDuplicateRemoteLocation,
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
console.log(" JOBCARD METADATA — DETERMINISTIC TESTS (Phase 2G-2)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] formatLocation — the trailing-comma bug (item 5) is fixed: a stray comma from missing source fields never survives");
{
  check(
    "city + state -> clean comma join",
    formatLocation({ raw: "x", display_name: null, city: "Bangalore", state: "Karnataka", country: null }) === "Bangalore, Karnataka"
  );
  check(
    "city only, state missing -> no trailing comma",
    formatLocation({ raw: "x", display_name: null, city: "Bangalore", state: null, country: null }) === "Bangalore"
  );
  check(
    "display_name carries a literal trailing comma from the source ('Remote,') -> cleaned to 'Remote'",
    formatLocation({ raw: "Remote,", display_name: "Remote,", city: null, state: null, country: null }) === "Remote"
  );
  check(
    "raw carries a literal trailing comma from the source (real RemoteOK-shaped data, e.g. 'Hounslow,') -> cleaned",
    formatLocation({ raw: "Hounslow,", display_name: "Hounslow,", city: null, state: null, country: null }) === "Hounslow"
  );
  check(
    "a leading comma is cleaned the same way",
    formatLocation({ raw: ", Pune", display_name: null, city: null, state: null, country: null }) === "Pune"
  );
  check(
    "an internal empty segment ('City, , Country') collapses without a bare double comma",
    formatLocation({ raw: "x", display_name: "City, , Country", city: null, state: null, country: null }) === "City, Country"
  );
  check(
    "the result never ends in a bare comma for any of the above",
    ![
      formatLocation({ raw: "x", display_name: null, city: "Bangalore", state: null, country: null }),
      formatLocation({ raw: "Remote,", display_name: "Remote,", city: null, state: null, country: null }),
    ].some((text) => typeof text === "string" && text.trim().endsWith(","))
  );
}

// ---------------------------------------------------------------------------
console.log("\n[2] formatLocation — never fabricates, never renders a structured object as text");
{
  check("completely empty location object -> null (honest, nothing fabricated)", formatLocation({ raw: "", display_name: null, city: null, state: null, country: null }) === null);
  check("null location -> null", formatLocation(null) === null);
  check(
    "a malformed field that is itself an object is rejected, never stringified into '[object Object]'",
    formatLocation({ raw: "x", display_name: { nested: true }, city: null, state: null, country: null }) === "x"
  );
  check(
    "a fully malformed location (every field itself an object) never returns '[object Object]'",
    formatLocation({ raw: {}, display_name: {}, city: {}, state: {}, country: {} }) !== "[object Object]"
  );
}

// ---------------------------------------------------------------------------
console.log("\n[3] formatRemoteBadge — only a confirmed true renders the badge (item 3 of the minimum test list)");
{
  check("true -> 'Remote'", formatRemoteBadge(true) === "Remote");
  check("false -> null (never a 'not remote' badge — no such badge exists in this design)", formatRemoteBadge(false) === null);
  check("null (unknown) -> null", formatRemoteBadge(null) === null);
  check("undefined -> null", formatRemoteBadge(undefined) === null);
  check("formatRemoteBadge is strictly narrower than formatRemote (which surfaces 'On-site' for false, used elsewhere)", formatRemoteBadge(false) === null);
}

// ---------------------------------------------------------------------------
console.log("\n[4] isDuplicateRemoteLocation — suppresses ONLY a contentless 'Remote' location on a confirmed-remote job (item 6)");
{
  check("confirmed remote + location text exactly 'Remote' -> suppress (true)", isDuplicateRemoteLocation(true, "Remote") === true);
  check("case-insensitive equivalence is also suppressed", isDuplicateRemoteLocation(true, "remote") === true);
  check("surrounding whitespace doesn't defeat the match", isDuplicateRemoteLocation(true, "  Remote  ") === true);
  check("a genuinely more specific location on a remote job is NEVER suppressed", isDuplicateRemoteLocation(true, "Remote, India") === false);
  check("a real physical city on a remote job is never suppressed", isDuplicateRemoteLocation(true, "Bangalore, Karnataka") === false);
  check("not confirmed remote -> never suppresses, even if the text happens to be 'Remote'", isDuplicateRemoteLocation(false, "Remote") === false);
  check("no location text at all -> false (nothing to suppress)", isDuplicateRemoteLocation(true, null) === false);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
