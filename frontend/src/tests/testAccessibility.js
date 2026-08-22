// Deterministic static verification for the Phase 2F accessibility pass.
// This is a practical, scoped audit — not a WCAG-certification claim
// (per this phase's own explicit instruction to report the scope
// honestly, not claim full certification). It checks the concrete,
// source-verifiable things this phase actually changed: real <label>
// elements/aria-labels on form inputs, a visible keyboard-focus
// indicator applied app-wide (previously absent entirely), accessible
// names on icon-only/opens-in-new-tab links, keyboard-operable controls
// (real <button>s, not clickable non-interactive elements), and
// associated error messaging. It does not measure color contrast ratios
// or run an automated axe-core-style audit (no such tool/dependency was
// added, per this phase's "no unnecessary dependencies" instruction) —
// see PHASE_2F_REPORT.md §12 for the honest scope statement. Run via
// `node src/tests/testAccessibility.js`.

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
console.log(" ACCESSIBILITY — PRACTICAL, SCOPED STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] A visible keyboard-focus indicator is applied app-wide (previously none existed at all — confirmed by a repo-wide grep for `outline` before this phase)");
{
  const mainScss = readSource("styles/main.scss");
  check("every native interactive element gets the shared focus-ring mixin", /a, button, input, select, textarea, \[tabindex\]\s*\{\s*@include focus-ring/.test(mainScss));

  const mixins = readSource("styles/_mixins.scss");
  check("the focus-ring mixin uses :focus-visible (keyboard/AT only, not a mouse click)", /@mixin focus-ring[\s\S]{0,120}:focus-visible/.test(mixins));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Login's password field has a real <label>, not just a placeholder (placeholders vanish once typing starts and aren't a reliable accessible name)");
{
  const source = readSource("pages/Login/Login.jsx");
  check("email input has an associated <label htmlFor>", /htmlFor="login-email"/.test(source) && /id="login-email"/.test(source));
  check("password input has an associated <label htmlFor>", /htmlFor="login-password"/.test(source) && /id="login-password"/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[3] The password-visibility toggle is a real, keyboard-operable <button> with an accessible name, not a clickable <img> (an onClick on a plain image is invisible to keyboard/AT users)");
{
  const source = readSource("pages/Login/Login.jsx");
  const toggleBlock = source.slice(source.indexOf("toggle-password"), source.indexOf("toggle-password") + 400);
  check("the toggle is a <button>, not a bare clickable <img>", /<button[\s\S]*toggle-password/.test(source));
  check("the toggle has an aria-label describing the action, not just an icon", /aria-label=\{showPassword \? "Hide password" : "Show password"\}/.test(source));
  check("aria-pressed reflects the toggle's own state", /aria-pressed=\{showPassword\}/.test(source));
  check("the decorative icon inside is hidden from assistive tech (empty alt + aria-hidden), since the button itself already has the accessible name", /alt=""/.test(toggleBlock) && /aria-hidden="true"/.test(toggleBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Links that open in a new tab announce that fact in their accessible name (a sighted user sees the ↗ glyph; a screen-reader user needs it said explicitly)");
// Phase 2G-2 note: JobCard's own "View Original" link (which this check
// originally covered) was intentionally removed this phase — the card's
// only actions are now "View Details" (internal SPA navigation via
// useNavigate, not a new-tab link) and Save, neither of which opens a
// new tab, so there is nothing left on JobCard for this specific check to
// cover. See testJobCard.js for JobCard's own current accessibility
// checks. Phase 2G-4 relabeled JobDetail's Apply action ("Apply Now ↗",
// was "Apply / View Original Job ↗") but kept this exact aria-label
// pattern and rel attribute unchanged — see testJobApply.js for that
// phase's own full Apply-flow coverage.
{
  const jobDetail = readSource("pages/JobDetail/JobDetail.jsx");
  check("JobDetail's Apply link has an aria-label mentioning it opens in a new tab", /aria-label=\{`Apply for[\s\S]{0,60}opens in a new tab/.test(jobDetail));
  check("JobDetail's Apply link still carries rel=\"noopener noreferrer\" (unchanged security behavior)", /rel="noopener noreferrer"/.test(jobDetail));
}

// ---------------------------------------------------------------------------
console.log("\n[5] The mobile nav toggle is a real <button> with a real accessible name that changes with its state (not an icon with no text alternative)");
{
  const source = readSource("components/Navbar/Navbar.jsx");
  check("aria-label toggles between 'Open navigation menu' and 'Close navigation menu'", /aria-label=\{mobileOpen \? "Close navigation menu" : "Open navigation menu"\}/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Contact form fields have accessible names (previously placeholder-only, same gap as Login's fields had)");
{
  const source = readSource("pages/Contact/Contact.jsx");
  check("name field has an aria-label", /aria-label="Your Name"/.test(source));
  check("email field has an aria-label", /aria-label="Your Email"/.test(source));
  check("message field has an aria-label", /aria-label="Message"/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Save-action error messages are associated with role=\"alert\" so assistive tech announces them without the user needing to find them visually");
{
  for (const [label, relPath] of [["JobCard.jsx", "components/JobCard/JobCard.jsx"], ["JobDetail.jsx", "pages/JobDetail/JobDetail.jsx"]]) {
    const source = readSource(relPath);
    check(`${label}'s save-error paragraph carries role="alert"`, /saveError &&[\s\S]{0,60}role="alert"/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[8] Disabled/loading button states use the real `disabled` attribute (not just a visual style), so assistive tech correctly reports them as unavailable");
{
  const sites = [
    ["Login.jsx", "pages/Login/Login.jsx", /disabled=\{isSubmitting\}/],
    ["Signup.jsx", "pages/Signup.jsx", /disabled=\{isSubmitting\}/],
    ["AddJob.jsx", "pages/AddJob.jsx", /disabled=\{status === "submitting"\}/],
    ["Profile.jsx", "pages/Profile.jsx", /disabled=\{saveState === "saving"\}/],
  ];
  for (const [label, relPath, pattern] of sites) {
    check(`${label}'s submit button uses a real disabled attribute during submission`, pattern.test(readSource(relPath)));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[9] Images convey their alt-text role correctly: informative images have real alt text, purely decorative ones are hidden from assistive tech instead of announced with a redundant/empty description");
{
  const jobCard = readSource("components/JobCard/JobCard.jsx");
  check("JobCard's company logo alt text names the company (not a generic 'logo')", /alt=\{job\.company\}/.test(jobCard));
  const jobDetail = readSource("pages/JobDetail/JobDetail.jsx");
  check("JobDetail's company logo alt text names the company", /alt=\{job\.company\}/.test(jobDetail));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
