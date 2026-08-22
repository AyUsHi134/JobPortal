// Deterministic verification for the Phase 2G-3 homepage hero search:
// the pure utils/homepageSearch.js validation/URL-building functions,
// plus static checks that Home.jsx actually wires them correctly — never
// calling the jobs API itself, never duplicating FindJob.jsx's real
// backend-side search, and submitting on both the button and the Enter
// key (native <form> submission). Run via
// `node src/tests/testHomepageSearch.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSearchQuery, buildJobSearchPath, EMPTY_SEARCH_MESSAGE } from "../utils/homepageSearch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

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
console.log(" HOMEPAGE SEARCH — DETERMINISTIC + STATIC VERIFICATION TESTS (Phase 2G-3)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] validateSearchQuery — an empty search is rejected, no request implied (item 1)");
{
  const result = validateSearchQuery("");
  check("empty string is invalid", result.valid === false);
  check("a clear inline validation message is returned", result.message === EMPTY_SEARCH_MESSAGE);
  check("the message is not a generic/vague string", /job title|skill|keyword/i.test(result.message));
}

// ---------------------------------------------------------------------------
console.log("\n[2] validateSearchQuery — a whitespace-only search is rejected (item 2)");
{
  for (const whitespaceOnly of ["   ", "\t", "\n", "  \n\t "]) {
    check(`"${JSON.stringify(whitespaceOnly)}" is rejected, not treated as a real query`, validateSearchQuery(whitespaceOnly).valid === false);
  }
  check("missing/undefined input is handled safely, never throws", validateSearchQuery(undefined).valid === false);
}

// ---------------------------------------------------------------------------
console.log("\n[3] validateSearchQuery — a meaningful query is accepted and trimmed (item 2's 'trim unnecessary whitespace')");
{
  const result = validateSearchQuery("  React Developer  ");
  check("valid", result.valid === true);
  check("surrounding whitespace is trimmed", result.query === "React Developer");
  check("the meaningful text itself is preserved exactly, not altered/lowercased", result.query === "React Developer");
  check("no validation message on the success path", result.message === null);
}

// ---------------------------------------------------------------------------
console.log("\n[4] buildJobSearchPath — navigates to the existing /jobs route with an encoded q param (items 3, 4)");
{
  check("a simple query builds the expected path", buildJobSearchPath("react developer") === "/jobs?q=react%20developer");
  check("an ampersand is encoded, so it can't inject a second query parameter", buildJobSearchPath("R&D") === "/jobs?q=R%26D");
  check("a '#' is encoded, so it can't be misread as a URL fragment", buildJobSearchPath("C#") === "/jobs?q=C%23");
  check("a '?' is encoded", buildJobSearchPath("what?").includes("%3F"));
  check("non-ASCII text round-trips safely (percent-encoded, not mangled)", decodeURIComponent(buildJobSearchPath("café").replace("/jobs?q=", "")) === "café");
  check("the path always targets the existing /jobs route — no new search endpoint is invented", buildJobSearchPath("x").startsWith("/jobs?q="));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Home.jsx wiring — empty search keeps the user on the homepage and never calls the jobs API (items 1, 6)");
{
  const home = readSource("pages/Home.jsx");
  check("handleHeroSearch checks validateSearchQuery(searchText) before doing anything else", /const result = validateSearchQuery\(searchText\);/.test(home));
  check("an invalid result sets an inline error and returns, without navigating", /if \(!result\.valid\)\s*\{\s*setSearchError\(result\.message\);\s*return;\s*\}/.test(home));
  check("only a valid result triggers navigate(...)", /navigate\(buildJobSearchPath\(result\.query\)\)/.test(home));
  check("the search handler itself never calls listJobs/fetch/axios directly", (() => {
    const fnStart = home.indexOf("const handleHeroSearch");
    const fnBody = home.slice(fnStart, home.indexOf("\n  };", fnStart));
    return !/listJobs|fetch\(|axios/.test(fnBody);
  })());
}

// ---------------------------------------------------------------------------
console.log("\n[6] Home.jsx wiring — validation is shown inline, never via alert() (item 'show validation without alert()')");
{
  const home = readSource("pages/Home.jsx");
  check("no alert(...) call exists in Home.jsx", !/\balert\(/.test(home));
  check("the search error is rendered inline with role=\"alert\"", /searchError &&[\s\S]{0,120}role="alert"/.test(home));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Home.jsx wiring — the search box is a real <form>, so both the button and the Enter key submit it (item 5)");
{
  const home = readSource("pages/Home.jsx");
  check("the search UI is a real form with onSubmit wired to handleHeroSearch", /component="form"[\s\S]{0,40}onSubmit=\{handleHeroSearch\}/.test(home));
  check("the Search control is type=\"submit\" (fires the form's onSubmit, works for both a click and Enter)", /type="submit"/.test(home));
  const formStart = home.indexOf('component="form"');
  const submitIdx = home.indexOf('type="submit"');
  const formFieldBlock = home.slice(formStart, submitIdx);
  check("the search input is not a multiline field (which would swallow Enter instead of submitting)", formStart !== -1 && submitIdx !== -1 && !/multiline/.test(formFieldBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[8] The homepage search does not fetch/render its own results — it only hands off to /jobs (item 'do not make the homepage search itself fetch and render search results')");
{
  const home = readSource("pages/Home.jsx");
  const searchFormBlock = home.slice(home.indexOf("component=\"form\""), home.indexOf("Recent Jobs"));
  check("no listJobs call exists inside the search form's own markup block", !/listJobs\(/.test(searchFormBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[9] Phase 2G-7B: the awkward floating-border label is removed; the useful inside example text and a real accessible label both remain (items 1, 2 of the 2G-7B brief)");
{
  const home = readSource("pages/Home.jsx");
  const formStart = home.indexOf('component="form"');
  const submitIdx = home.indexOf('type="submit"');
  const searchFieldBlock = home.slice(formStart, submitIdx);

  check("the inside example placeholder text is kept", /placeholder="e\.g\. React Developer"/.test(searchFieldBlock));
  check("the MUI outlined `label` prop (the floating-border text) is gone from the search TextField", !/label="Job title, skill, or keyword"/.test(searchFieldBlock));
  check("a real accessible label (aria-label) still names the field — removing the visual label did not remove accessible labeling", /aria-label="Search jobs by title, skill, or keyword"/.test(searchFieldBlock));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
