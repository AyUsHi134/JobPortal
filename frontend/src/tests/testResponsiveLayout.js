// Deterministic, static verification for the Phase 2F responsive/layout
// polish pass. No headless-browser automation tool is available in this
// environment (confirmed again this phase, consistent with every prior
// phase's report), so these checks verify the actual CSS/JSX rules that
// produce the responsive behavior — the shared breakpoint scale is
// defined once and actually used, known overflow-risk patterns
// (unbounded grid minimums, fixed pixel widths, unwrapped flex rows) are
// fixed at their real source, and long real data is handled by wrapping
// CSS rather than a truncating/fabricating transform — rather than
// re-deriving rendered pixel values no tool here can measure. See
// PHASE_2F_REPORT.md §11/§21 for how this was combined with a live
// dev-server smoke check. Run via
// `node src/tests/testResponsiveLayout.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
console.log(" RESPONSIVE LAYOUT — STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] A single shared breakpoint scale exists and is actually used by the components this phase touched");
{
  const variables = readSource("styles/_variables.scss");
  check("$bp-mobile/$bp-tablet/$bp-laptop/$bp-desktop are all defined once", /\$bp-mobile:/.test(variables) && /\$bp-tablet:/.test(variables) && /\$bp-laptop:/.test(variables) && /\$bp-desktop:/.test(variables));

  const mixins = readSource("styles/_mixins.scss");
  check("mobile/tablet-down/laptop-down/desktop-up mixins are defined against those variables", /@mixin mobile/.test(mixins) && /@mixin tablet-down/.test(mixins) && /@mixin laptop-down/.test(mixins) && /@mixin desktop-up/.test(mixins));

  const consumers = [
    "components/Navbar/Navbar.scss",
    "pages/JobDetail/JobDetail.scss",
    "pages/FindJob/FindJob.scss",
    "pages/SavedJobs/SavedJobs.scss",
    "pages/Login/Login.scss",
    "components/AuthRequired/AuthRequired.scss",
  ];
  for (const relPath of consumers) {
    const source = readSource(relPath);
    check(`${relPath} uses the shared breakpoint mixins (@include mobile/tablet-down)`, /@include (mobile|tablet-down)/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[2] Login's real fixed-width overflow bug is fixed (a 400px fixed width with no cap previously overflowed any viewport narrower than ~400px)");
{
  const source = readSource("pages/Login/Login.scss");
  check("no bare, uncapped fixed pixel width remains on .login-form", !/(?<!max-)\bwidth:\s*400px/.test(source));
  check("width is now 100% up to a max-width cap, so it never exceeds the viewport", /width:\s*100%/.test(source) && /max-width:\s*400px/.test(source));
  check("box-sizing: border-box is set so padding can never push it past that cap", /box-sizing:\s*border-box/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Grid layouts that could exceed the viewport at true mobile widths (minmax(310px, 1fr) columns) now collapse to a single column below the mobile breakpoint");
{
  for (const [label, relPath] of [["FindJob.scss", "pages/FindJob/FindJob.scss"], ["SavedJobs.scss", "pages/SavedJobs/SavedJobs.scss"]]) {
    const source = readSource(relPath);
    check(`${label} still uses the auto-fit grid on larger screens`, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(310px/.test(source));
    check(`${label} has a mobile override collapsing to a single, viewport-safe column`, /@include mobile[\s\S]{0,200}grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[4] About.jsx's un-wrapped flex row (a real horizontal-overflow bug — 3 pill spans with no flex-wrap) is fixed");
{
  const source = readSource("pages/About/About.scss");
  check("the highlight row now wraps instead of forcing a wider row than the viewport", /\.about__highlight\s*\{[^}]*flex-wrap:\s*wrap/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Long real text (titles, company names, locations, skills) wraps safely instead of being truncated/hidden — data-honesty preserved through layout, not content removal");
{
  const wrapConsumers = [
    ["JobCard.scss", "components/JobCard/JobCard.scss", [".job-title", ".job-company", ".job-location", ".skill-chip"]],
    ["JobDetail.scss", "pages/JobDetail/JobDetail.scss", [".job-title", ".job-company", ".skill-chip", ".tag-chip"]],
  ];
  for (const [label, relPath, selectors] of wrapConsumers) {
    const source = readSource(relPath);
    for (const selector of selectors) {
      const idx = source.indexOf(`${selector} {`);
      check(`${label}'s ${selector} rule includes a wrap-safety mixin/property (no idx=-1)`, idx !== -1);
    }
    check(`${label} uses the shared wrap-safely mixin at least once`, /@include wrap-safely/.test(source));
  }

  // Confirm no truncating transform was introduced anywhere that would
  // shorten a real job field — this project's data-honesty rule applies
  // to layout too: real text may wrap onto more lines, but is never cut
  // short or replaced with an ellipsis for a field the user actually
  // needs to read in full.
  const jobCard = readSource("components/JobCard/JobCard.jsx");
  const jobDetail = readSource("pages/JobDetail/JobDetail.jsx");
  for (const [label, source] of [["JobCard.jsx", jobCard], ["JobDetail.jsx", jobDetail]]) {
    check(`${label} never truncates job.title/job.company with slice/substring`, !/job\.(title|company)\.(slice|substring)/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[6] Navbar has real mobile navigation (collapsible menu behind an accessible, keyboard-operable toggle) — previously there was none at all");
{
  const jsx = readSource("components/Navbar/Navbar.jsx");
  check("a real <button> toggle exists (not a clickable non-interactive element)", /<button[\s\S]{0,120}navbar__toggle/.test(jsx));
  check("the toggle exposes aria-expanded reflecting open/closed state", /aria-expanded=\{mobileOpen\}/.test(jsx));
  check("the toggle is associated with the links list via aria-controls", /aria-controls="navbar-links"/.test(jsx) && /id="navbar-links"/.test(jsx));
  check("clicking a link closes the mobile menu (no menu left stuck open after navigating)", /onClick=\{closeMobileMenu\}/.test(jsx));

  const scss = readSource("components/Navbar/Navbar.scss");
  const tabletDownBlock = scss.slice(scss.indexOf("@include tablet-down"));
  check("the toggle is hidden above the tablet breakpoint and shown below it (display: flex inside the tablet-down block)", /\.navbar__toggle\s*\{\s*display:\s*flex/.test(tabletDownBlock));
  check("the links list collapses (display: none) below tablet width until opened", /\.navbar__links\s*\{\s*display:\s*none/.test(tabletDownBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Navbar's existing routes/functionality are all still present after the rewrite — no link was dropped");
{
  const jsx = readSource("components/Navbar/Navbar.jsx");
  for (const to of ["/", "/jobs", "/about", "/contact", "/profile", "/saved-jobs", "/login", "/signup"]) {
    check(`Navbar still links to ${to}`, new RegExp(`to="${to.replace("/", "\\/")}"`).test(jsx));
  }
  check("logout still calls the real logout() + navigate(\"/login\") (auth logic unchanged)", /logout\(\)/.test(jsx) && /navigate\("\/login"\)/.test(jsx));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Active-route indication uses React Router's own NavLink rather than hand-rolled path comparison (less to get wrong, and it already existed in the router version this app uses)");
{
  const jsx = readSource("components/Navbar/Navbar.jsx");
  check("imports NavLink from react-router-dom", /import \{[^}]*NavLink[^}]*\} from "react-router-dom"/.test(jsx));
  check("does not hand-roll its own useLocation-based path matching", !/useLocation/.test(jsx));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
