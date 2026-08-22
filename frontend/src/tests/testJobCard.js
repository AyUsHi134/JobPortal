// Deterministic, static verification for the Phase 2G-2 JobCard redesign
// itself: source removal, the fixed badge area/order, the "Save" (never
// "Log in to Save") label on a logged-out card, the single "View
// Details" action replacing Apply/View Original, and a stable
// badge -> company -> title -> location -> skills -> salary -> posted ->
// actions layout order. No component-render library is installed in this
// project (the same limitation every prior phase's report has stated),
// so — exactly like testAccessibility.js / testResponsiveLayout.js /
// testNavbar.js already do — this reads the real JobCard.jsx/.scss
// source directly; since JobCard's rendering is a direct, unconditional
// pass-through of these source decisions into JSX, verifying the source
// IS verifying the actual rendering decision. Run via
// `node src/tests/testJobCard.js`.

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
console.log(" JOBCARD REDESIGN — STATIC VERIFICATION TESTS (Phase 2G-2)");
console.log("============================");

const JOB_CARD = readSource("components/JobCard/JobCard.jsx");
const JOB_CARD_SCSS = readSource("components/JobCard/JobCard.scss");

// ---------------------------------------------------------------------------
console.log("\n[1] Source (Adzuna/RemoteOK) is never rendered on the card (item 1 of the minimum test list) — the backend field itself is untouched, only its presentation here is removed");
{
  check("JobCard.jsx no longer imports formatSource", !/formatSource/.test(JOB_CARD));
  check("no 'via ...' source text is rendered", !/via \{/.test(JOB_CARD) && !/>\s*via\s*</.test(JOB_CARD));
  check("no literal 'Adzuna'/'RemoteOK' string is rendered as UI copy", !/["'>]Adzuna["'<]/.test(JOB_CARD) && !/["'>]RemoteOK["'<]/.test(JOB_CARD));
  check("job.source is never read for display", !/job\.source\b/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Remote badge renders only for a confirmed-remote job (item 2)");
{
  check("uses the badge-specific formatRemoteBadge, not the JobDetail-shared formatRemote (which also surfaces 'On-site')", /formatRemoteBadge\(job\.is_remote\)/.test(JOB_CARD));
  check("does not import formatRemote (the On-site-capable formatter) into JobCard at all", !/\bformatRemote\b/.test(JOB_CARD.replace(/formatRemoteBadge/g, "")));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Tech badge renders only for a confirmed-tech job (item 3)");
{
  check("uses formatTechRelevance(job.is_tech_relevant), which only ever returns a positive 'Tech' signal", /formatTechRelevance\(job\.is_tech_relevant\)/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Experience badge renders correctly, never for an unclassified level (item 4)");
{
  check("uses formatExperience(job.experience_level), which returns null for 'unknown'/unrecognized", /formatExperience\(job\.experience_level\)/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[5] 2G-7C: the badge/tag area is a single block positioned AFTER the posted date and before the footer actions, in a stable Remote -> Experience -> Tech order, and it's entirely absent (not just empty) when there's nothing to show (item 5, revised structure)");
{
  const tagsSectionIdx = JOB_CARD.indexOf("job-tags-section");
  const postedIdx = JOB_CARD.indexOf("job-card-meta");
  const actionsIdx = JOB_CARD.indexOf("job-card-actions");
  const remoteIdx = JOB_CARD.indexOf("remoteBadgeText &&");
  const experienceIdx = JOB_CARD.indexOf("experienceText &&");
  const techIdx = JOB_CARD.indexOf("techText &&");
  check("the tags/badges section is positioned after the posted-date block and before the footer actions", tagsSectionIdx !== -1 && postedIdx !== -1 && actionsIdx !== -1 && postedIdx < tagsSectionIdx && tagsSectionIdx < actionsIdx);
  check("all three badge conditions live inside the same job-tags-section block, not scattered elsewhere", remoteIdx > tagsSectionIdx && experienceIdx > tagsSectionIdx && techIdx > tagsSectionIdx && remoteIdx < actionsIdx && experienceIdx < actionsIdx && techIdx < actionsIdx);
  check("badges render in Remote -> Experience -> Tech order", remoteIdx < experienceIdx && experienceIdx < techIdx);
  check("there is exactly one badge-area block (no second, duplicate .job-badges elsewhere)", (JOB_CARD.match(/job-badges/g) || []).length === 1);
  check("the whole tags/badges section is conditionally rendered (hasTagsOrBadges), so a job with neither a badge nor a skill renders no empty block at all", /\{hasTagsOrBadges &&/.test(JOB_CARD));
  check("hasTagsOrBadges is derived from real badge/skill data, not hardcoded true/false", /const hasBadges = Boolean\(remoteBadgeText \|\| experienceText \|\| techText\);/.test(JOB_CARD) && /const hasTagsOrBadges = hasBadges \|\| skills\.length > 0;/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[6] A confirmed-remote job never shows 'Remote' a second time as the location (item 6)");
{
  check("uses isDuplicateRemoteLocation to decide whether to null out the location text", /isDuplicateRemoteLocation\(isRemote, rawLocationText\)/.test(JOB_CARD));
  check("isRemote is derived strictly from is_remote === true (tri-state honored, not truthy-coerced)", /const isRemote = job\.is_remote === true;/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Location formatting never renders the raw location object, and honestly omits an empty location (items 5, 9, 10 combined at the render layer)");
{
  check("location is rendered via formatLocation(job.location), never job.location directly", /formatLocation\(job\.location\)/.test(JOB_CARD) && !/\{job\.location\}/.test(JOB_CARD));
  check("the location line is conditionally rendered, so a null result renders nothing rather than an empty row", /\{locationText && \(/.test(JOB_CARD) || /\{locationText &&/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Skills are capped to a small number and never fabricated when absent (items 10, 11)");
{
  check("skills are sliced to at most 3", /\.slice\(0, 3\)/.test(JOB_CARD));
  check("skills come only from the real normalized_skills array (Array-guarded), never a hardcoded/default list", /Array\.isArray\(job\.normalized_skills\)/.test(JOB_CARD));
  check("the skills row is conditionally rendered (skills.length > 0), so a missing/empty list renders no row at all", /skills\.length > 0/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[9] A logged-out card always reads 'Save', never 'Log in to Save' (item 7 / item 12)");
{
  check("the literal string 'Log in to Save' does not appear anywhere in JobCard.jsx", !/Log in to Save/.test(JOB_CARD));
  check("the login-action save state's label is overridden to 'Save' at the JobCard layer, without touching the shared savedJobUi.js util", /rawSaveButtonState\.action === "login"[\s\S]{0,80}label: "Save"/.test(JOB_CARD));
  check("the shared getSaveButtonState import/call is still present (no reimplementation of the decision logic)", /getSaveButtonState\(\{ isAuthenticated, isSaved, isSaving \}\)/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[10] The card's only actions are 'View Details' and 'Save' — Apply and 'View Original' are both gone (item 8 / items 17, 18)");
{
  check("no 'apply-btn' class remains", !/apply-btn/.test(JOB_CARD));
  check("no 'original-listing-link' element/class remains", !/original-listing-link/.test(JOB_CARD));
  check("no 'View Original' text remains", !/View Original/.test(JOB_CARD));
  check("the card never links directly to job.apply_link (no direct-to-original-URL affordance on the card)", !/href=\{job\.apply_link\}/.test(JOB_CARD));
  check("isValidApplyLink is no longer imported/used by JobCard (that decision now belongs to Job Detail only)", !/isValidApplyLink/.test(JOB_CARD));
  check("a 'View Details' button is rendered", /View Details/.test(JOB_CARD));
  check("View Details navigates to the canonical /job/:id detail route using only the id", /navigate\(`\/job\/\$\{job\._id\}`\)/.test(JOB_CARD));
  check("View Details is a real <button>, not an <a> (no direct external navigation from the card)", /<button className="view-details-btn"/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[11] 2G-7C: overall structural order matches the revised hierarchy: company, title, location, salary, posted date, tags/badges, actions (item 4 of the 2G-7C brief)");
{
  const order = [
    "job-company-row",
    "job-title",
    "locationText &&",
    "job-salary",
    "job-card-meta",
    "job-tags-section",
    "job-card-actions",
  ].map((marker) => JOB_CARD.indexOf(marker));

  check("every expected structural marker is present in the source", order.every((idx) => idx !== -1));
  check(
    "markers appear in the required top-to-bottom order",
    order.every((idx, i) => i === 0 || idx > order[i - 1])
  );
}

// ---------------------------------------------------------------------------
console.log("\n[12] Save-in-flight still prevents a duplicate request, and the saved state still renders (items 15, 16) — the shared hook/util contract is unchanged");
{
  check("disabled uses saveButton.disabled (sourced from the shared getSaveButtonState, isSaving-aware)", /disabled=\{saveButton\.disabled\}/.test(JOB_CARD));
  check("the saved-state class toggle is preserved", /save-btn\$\{isSaved \? " saved" : ""\}/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[13] No client-supplied user id is ever sent or rendered (item 14, re-verified for this rewritten file)");
{
  check("JobCard.jsx does not reference user._id/user.id anywhere", !/user\._id|user\.id\b/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[14] Accessibility: both card actions are real, keyboard-operable controls with understandable state, and Save is a real toggle-aware button (item 12 of the accessibility section)");
{
  check("exactly two <button> elements exist in the action area (View Details, Save) — no icon-only control with no accessible name", (JOB_CARD.match(/<button/g) || []).length === 2);
  check("the Save button exposes aria-pressed reflecting the saved state", /aria-pressed=\{isSaved\}/.test(JOB_CARD));
  check("save errors are still announced via role=\"alert\" (unchanged from Phase 2E)", /saveError &&[\s\S]{0,60}role="alert"/.test(JOB_CARD));
}

// ---------------------------------------------------------------------------
console.log("\n[15] Long real content wraps safely; the redesign introduces no horizontal-overflow risk and no new fabricated data (items 10, 19)");
{
  for (const selector of [".job-title", ".job-company", ".job-location", ".skill-chip"]) {
    check(`JobCard.scss's ${selector} rule exists`, JOB_CARD_SCSS.indexOf(`${selector} {`) !== -1);
  }
  check("JobCard.scss uses the shared wrap-safety mixin", /@include wrap-safely/.test(JOB_CARD_SCSS));

  // Scoped to just the card's own top-level properties (before any
  // nested selector) — a small fixed-size element like `.job-logo`
  // legitimately keeps a bare pixel width (a 36px square icon isn't an
  // overflow risk), so this must not be checked file-wide.
  const cardTopLevel = JOB_CARD_SCSS.slice(JOB_CARD_SCSS.indexOf(".modern-job-card {"), JOB_CARD_SCSS.indexOf(".job-company-row {"));
  check("no bare fixed pixel width without a max-width cap was introduced on the card container itself", !/(?<!max-)\bwidth:\s*\d+px/.test(cardTopLevel));
  check("the card still caps its own width responsively (max-width, not a bare fixed width)", /max-width:\s*340px/.test(cardTopLevel));
}

// ---------------------------------------------------------------------------
console.log("\n[16] The green design system is used, not new one-off purple/lavender values (theme continuity with Phase 2G-1)");
{
  const KNOWN_PURPLE_HEXES = ["#7046d3", "#5f3dbf", "#ece4fa", "#faf7ff", "#2a223e", "#5f43b2", "#a596c9", "#ebe3fb", "#a276e8", "#8457e7", "#987fe7", "#563ba7", "#6d4cbe", "#51308d", "#7b59c6", "#f5f1fc", "#d7c7ff", "#bfe8cf"];
  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => JOB_CARD_SCSS.toLowerCase().includes(hex));
  check("JobCard.scss contains no old purple/lavender hex value", offenders.length === 0);
  check("JobCard.scss reads its palette from the shared design tokens", /\$primary-color|\$primary-hover|\$accent-color|\$text-dark|\$text-muted|\$border-color|\$box-shadow/.test(JOB_CARD_SCSS));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
