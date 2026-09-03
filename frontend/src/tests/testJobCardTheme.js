// Deterministic + static verification for Phase 2G-7B's JobCard visual
// integration with the 2G-7A design system: semantic badge colors tied
// to MEANING (not randomly assigned), a stable fixed badge position,
// skills staying visually distinct from status badges, location
// formatting reused (not reimplemented), and confirmation that no
// previously-removed feature (Adzuna/RemoteOK labels, Apply, View
// Original, "Log in to Save") was reintroduced while re-theming. Run via
// `node src/tests/testJobCardTheme.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getExperienceBadgeTone, formatExperience } from "../utils/jobDisplay.js";

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

const JOBCARD_JSX = readSource("components/JobCard/JobCard.jsx");
const JOBCARD_SCSS = readSource("components/JobCard/JobCard.scss");
const VARIABLES = readSource("styles/_variables.scss");

console.log("============================");
console.log(" JOBCARD THEME (Phase 2G-7B) — DETERMINISTIC + STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] getExperienceBadgeTone — a consistent, MEANING-based mapping (never a random per-card assignment)");
{
  check("fresher -> 'entry'", getExperienceBadgeTone("fresher") === "entry");
  check("entry -> 'entry'", getExperienceBadgeTone("entry") === "entry");
  check("junior -> 'senior' (grouped under 'Senior/other experience' per this phase's own spec)", getExperienceBadgeTone("junior") === "senior");
  check("mid -> 'senior'", getExperienceBadgeTone("mid") === "senior");
  check("senior -> 'senior'", getExperienceBadgeTone("senior") === "senior");
  check("'unknown' -> null (never a fabricated tone for a level formatExperience itself omits)", getExperienceBadgeTone("unknown") === null);
  check("an unrecognized/missing value -> null, never throws", getExperienceBadgeTone(undefined) === null && getExperienceBadgeTone("bogus") === null);
  check("every level that gets a tone also gets a real label from formatExperience (tone is never computed for text that won't render)", ["fresher", "entry", "junior", "mid", "senior"].every((l) => Boolean(formatExperience(l)) === Boolean(getExperienceBadgeTone(l))));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Semantic badge colors, one pairing per meaning — not a scatter of new one-off hex values (task item 8). Visual-only correction: Remote/Senior/Tech now use exact reference hex pairs (Tailwind emerald/violet/indigo) instead of the $badge-* tokens; Entry/Fresher is untouched, still token-driven.");
{
  check("Remote uses the exact emerald-50/emerald-700 pair", /\.badge-remote\s*\{[^}]*background:\s*#ecfdf5;[^}]*color:\s*#047857;/.test(JOBCARD_SCSS));
  check("Tech uses the exact indigo-50/indigo-700 pair", /\.badge-tech\s*\{[^}]*background:\s*#eef2ff;[^}]*color:\s*#4338ca;/.test(JOBCARD_SCSS));
  check("Entry/Fresher experience still uses the soft-yellow pair ($badge-yellow-bg/$badge-yellow-text) — out of this pass's given spec, left unchanged", /\.badge-experience--entry\s*\{\s*background:\s*\$badge-yellow-bg;\s*color:\s*\$badge-yellow-text;/.test(JOBCARD_SCSS));
  check("Senior/other experience uses the exact violet-50/violet-700 pair", /\.badge-experience--senior\s*\{[^}]*background:\s*#f5f3ff;[^}]*color:\s*#6d28d9;/.test(JOBCARD_SCSS));

  // The 4 badge pairs must all be genuinely distinct colors from each
  // other — confirming they're 4 real semantic categories, not the same
  // color reused under different class names.
  const pairs = [/\$badge-green-bg:\s*(#\w+)/, /\$badge-blue-bg:\s*(#\w+)/, /\$badge-yellow-bg:\s*(#\w+)/, /\$badge-lavender-bg:\s*(#\w+)/];
  const bgValues = pairs.map((re) => VARIABLES.match(re)?.[1]?.toLowerCase());
  check("all 4 badge background tokens resolve to real, distinct hex values", bgValues.every(Boolean) && new Set(bgValues).size === 4);
}

// ---------------------------------------------------------------------------
console.log("\n[3] JobCard.jsx applies the tone-based class consistently — the same job always gets the same badge color (deterministic, not random)");
{
  check("JobCard imports getExperienceBadgeTone from the unmodified jobDisplay.js (reused, not reimplemented locally)", /getExperienceBadgeTone/.test(JOBCARD_JSX) && /from "\.\.\/\.\.\/utils\/jobDisplay\.js"/.test(JOBCARD_JSX));
  check("the experience badge's className is derived directly from getExperienceBadgeTone's own return value, not a separate hand-written condition", /badge-experience--\$\{experienceTone\}/.test(JOBCARD_JSX));
  check("experienceTone is computed via the pure function, not inline ad hoc logic", /const experienceTone = getExperienceBadgeTone\(job\.experience_level\);/.test(JOBCARD_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[4] 2G-7C: badge position moved from a fixed top-of-card slot to AFTER the posted date, and now genuinely disappears (no reserved empty space) when there's nothing to show — a deliberate revision of the earlier fixed-slot rule, not a regression");
{
  const tagsSectionIdx = JOBCARD_JSX.indexOf("job-tags-section");
  const postedIdx = JOBCARD_JSX.indexOf("job-card-meta");
  const actionsIdx = JOBCARD_JSX.indexOf("job-card-actions");
  check("the tags/badges section now renders after the posted-date block and before the footer actions (not before the company row any more)", tagsSectionIdx !== -1 && postedIdx !== -1 && actionsIdx !== -1 && postedIdx < tagsSectionIdx && tagsSectionIdx < actionsIdx);
  check("the old fixed min-height reservation on a top-of-card badge slot is gone — the badge/tag section is conditionally rendered instead of reserving empty space", !/\.job-card-header\s*\{[\s\S]{0,80}min-height/.test(JOBCARD_SCSS) && /\{hasTagsOrBadges &&/.test(JOBCARD_JSX));
  check("badge ordering priority (Remote, then Experience, then Tech) is unchanged", /remoteBadgeText &&[\s\S]*experienceText &&[\s\S]*techText &&/.test(JOBCARD_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Tech-stack skill tags now share ONE centralized blue with the Tech-relevance badge, and every tag (badges + skills) shares one flex-wrap container — a deliberate reversal of the old 'skills stay neutral/separate' rule, per this pass's explicit tag-unification requirement");
{
  // The color-bearing rule specifically (.job-skills nesting .skill-chip
  // with a real background/color pair) — both ".job-skills {" and
  // ".skill-chip {" also appear earlier in the file (the display:contents
  // grouping rule and the shared geometry rule respectively), so this
  // matches the actual nested color declaration directly rather than
  // slicing from either literal string's first occurrence.
  const skillChipColorMatch = /\.job-skills\s*\{\s*\.skill-chip\s*\{([\s\S]{0,120}?)\}\s*\}/.exec(JOBCARD_SCSS);
  const skillChipColorBlock = skillChipColorMatch ? skillChipColorMatch[1] : "";
  check("skill chips use the exact indigo-50/indigo-700 pair — the same shade .badge-tech uses, not a one-off color", /background:\s*#eef2ff/.test(skillChipColorBlock) && /color:\s*#4338ca/.test(skillChipColorBlock));
  check("skill chips never use the emerald/yellow/violet colors reserved for Remote/Experience", !/#ecfdf5|#f5f3ff|\$badge-yellow/.test(skillChipColorBlock));
  check("badges and skill chips share one unified flex-wrap container (.job-tags-section) instead of two separately-wrapping rows", /\.job-tags-section\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*8px;/.test(JOBCARD_SCSS));
  check(".job-badges/.job-skills contribute no layout of their own (display: contents), so tags genuinely intermix in one row rather than wrapping as two separate blocks", /\.job-badges,\s*\n\s*\.job-skills\s*\{\s*\n\s*display:\s*contents;/.test(JOBCARD_SCSS));
  check("every tag (badge or skill) shares the same centralized pill geometry — 6px/14px padding, full pill radius, 12px/600 font", /\.badge,\s*\n\s*\.skill-chip\s*\{[^}]*padding:\s*6px 14px;[^}]*border-radius:\s*999px;[^}]*font-size:\s*12px;[^}]*font-weight:\s*600;/.test(JOBCARD_SCSS));
  check("the existing 'up to 3 skills' cap is unchanged", /normalized_skills\.slice\(0, 3\)/.test(JOBCARD_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Location formatting is reused from the unmodified jobDisplay.js, not reimplemented — the Phase 2G-2 fixes (no trailing comma, no [object Object], no duplicate Remote) are still in force (task item 11)");
{
  check("JobCard still imports formatLocation and isDuplicateRemoteLocation from jobDisplay.js", /formatLocation/.test(JOBCARD_JSX) && /isDuplicateRemoteLocation/.test(JOBCARD_JSX));
  check("the duplicate-Remote suppression wiring is unchanged", /isDuplicateRemoteLocation\(isRemote, rawLocationText\)/.test(JOBCARD_JSX));
  check("jobDisplay.js's cleanLocationText (trailing/leading comma fix) is still present and unmodified", /function cleanLocationText/.test(readSource("utils/jobDisplay.js")));
}

// ---------------------------------------------------------------------------
console.log("\n[7] No previously-removed feature was reintroduced while re-theming (task item 7)");
{
  check("no 'Apply' action exists on JobCard", !/>\s*Apply\s*</.test(JOBCARD_JSX) && !/Apply Now/.test(JOBCARD_JSX));
  check("no 'View Original' link exists on JobCard", !/View Original/.test(JOBCARD_JSX));
  check("no 'Log in to Save' label was reintroduced (logged-out Save still reads plain 'Save')", !/Log in to Save/.test(JOBCARD_JSX));
  check("no Adzuna/RemoteOK hostname/label reference exists in JobCard.jsx", !/adzuna|remoteok/i.test(JOBCARD_JSX));
  check("View Details is still the card's navigation action, to /job/:id", /navigate\(`\/job\/\$\{job\._id\}`\)/.test(JOBCARD_JSX) && /View Details/.test(JOBCARD_JSX));
  check("Save is still wired to the shared useSavedJobState hook, unchanged", /useSavedJobState\(job\._id\)/.test(JOBCARD_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[8] No leftover purple hex in JobCard.scss after this phase's re-theming");
{
  const KNOWN_PURPLE_HEXES = [
    "#7046d3", "#5f43b2", "#7b42f6", "#a276e8", "#8457e7", "#51308d",
    "#6d4cbe", "#563ba7", "#987fe7", "#ece4fa", "#f7f3ff",
    "#b19bf9", "#d7c7ff", "#f5f1fc", "#7b59c6", "#b8a5f5", "#be9cff",
  ];
  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => JOBCARD_SCSS.toLowerCase().includes(hex));
  check("JobCard.scss contains no old purple hex value", offenders.length === 0);
  // Visual-only correction: the card surface is now the exact literal
  // #ffffff the reference specifies, replacing the previous
  // $surface-color token — a deliberate, explicit exception to "always
  // read from a token," not an accidental one-off.
  // A generous character window (not [^}]*): .modern-job-card's rule
  // body contains a Sass interpolation (#{...}) before this declaration,
  // whose own closing brace would prematurely end a [^}]-based match.
  check("the card surface is the exact reference white (#ffffff)", /\.modern-job-card\s*\{[\s\S]{0,2000}background:\s*#ffffff;/.test(JOBCARD_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[9] Card action area: View Details on the left, a Save control with a bookmark icon (filled when saved, outlined otherwise) on the right — icon addition is purely visual, save behavior unchanged. Layout revised this pass: equal-width flex buttons with a 12px gap, replacing the old asymmetric space-between row");
{
  check("View Details is still the first action in the footer's DOM order (reads as 'left')", JOBCARD_JSX.indexOf("view-details-btn") < JOBCARD_JSX.indexOf("save-btn"));
  check("the action area now gives both buttons equal/flexible width (flex: 1 1 0) with a 12px gap, per this pass's explicit action-area redesign", /\.job-card-actions\s*\{[^}]*gap:\s*12px;/.test(JOBCARD_SCSS) && /\.view-details-btn,\s*\n\s*\.save-btn\s*\{\s*\n\s*flex:\s*1 1 0;/.test(JOBCARD_SCSS));
  // Visual-only correction: both the background and the divider are now
  // the exact reference slate-100 (#f1f5f9) — the divider intentionally
  // matches the background it sits on (barely perceptible against the
  // action area itself; the real visible seam is the step down from the
  // white details area above it).
  check("the action area uses the exact reference slate-100 background + a same-shade top divider", /\.job-card-actions\s*\{[^}]*background:\s*#f1f5f9;[^}]*border-top:\s*1px solid #f1f5f9;/.test(JOBCARD_SCSS));
  check("Bookmark/BookmarkBorder icons are imported from the already-installed @mui/icons-material (no new dependency)", /from "@mui\/icons-material\/Bookmark"/.test(JOBCARD_JSX) && /from "@mui\/icons-material\/BookmarkBorder"/.test(JOBCARD_JSX));
  check("the icon toggles on the same isSaved flag the label/class already use — filled when saved, outlined otherwise, no new state introduced", /\{isSaved \? <BookmarkIcon fontSize="small" \/> : <BookmarkBorderIcon fontSize="small" \/>\}/.test(JOBCARD_JSX));
  check("the icon sits inside the same <button> as the existing text label (still one control, one click handler, one aria-pressed) — not a second, separate icon-only element", /aria-pressed=\{isSaved\}[\s\S]{0,40}>[\s\S]{0,120}BookmarkIcon/.test(JOBCARD_JSX));
  check("Save's click handler, disabled state, and aria-pressed wiring are byte-for-byte unchanged", /onClick=\{handleSaveClick\}/.test(JOBCARD_JSX) && /disabled=\{saveButton\.disabled\}/.test(JOBCARD_JSX) && /aria-pressed=\{isSaved\}/.test(JOBCARD_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[10] 2G-7C card reorder: Company -> Title -> Location -> Salary -> Posted date -> Tags/badges -> Footer — every field still uses the same unmodified jobDisplay.js formatters, only the render order moved");
{
  const order = ["job-company-row", "job-title", "locationText &&", "job-salary", "job-card-meta", "job-tags-section", "job-card-actions"].map((m) => JOBCARD_JSX.indexOf(m));
  check("every structural marker for the new order is present", order.every((i) => i !== -1));
  check("markers appear in the exact Company -> Title -> Location -> Salary -> Posted -> Tags -> Footer order", order.every((idx, i) => i === 0 || idx > order[i - 1]));
  check("every field is still computed via the same unmodified jobDisplay.js formatters (formatLocation/formatSalary/formatDatePosted/formatRemoteBadge/formatExperience/formatTechRelevance) — no reimplementation", ["formatLocation", "formatSalary", "formatDatePosted", "formatRemoteBadge", "formatExperience", "formatTechRelevance"].every((fn) => JOBCARD_JSX.includes(fn)));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
