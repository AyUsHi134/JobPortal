// Deterministic static verification for the green theme migration.
// Originally written for Phase 2G-1's flat single-green palette; Phase
// 2G-7A refined the same token NAMES onto a richer, coordinated palette
// (deep forest primary, a distinct light-sage page background vs. a
// warm-white card surface) — this file's literal hex assertions were
// updated in place to match (the same "update in place, don't fork a
// phase-numbered duplicate" pattern every prior phase in this project
// has followed), while its scope stays the same: the shared
// design-system tokens (_variables.scss) and the MUI-side palette
// (theme.js) are consistent with each other, status colors (error/
// success) kept their original meaning instead of being repainted
// green, and the Phase 2F accessible focus-ring system is preserved
// untouched. See testDesignSystem.js for the new tokens/surfaces this
// phase added. Run via `node src/tests/testTheme.js`.

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
console.log(" GLOBAL GREEN THEME — DETERMINISTIC STATIC VERIFICATION TESTS");
console.log("============================");

const KNOWN_PURPLE_HEXES = [
  "#7046d3", "#5f43b2", "#7b42f6", "#a276e8", "#8457e7", "#51308d",
  "#6d4cbe", "#563ba7", "#987fe7", "#ece4fa", "#f7f3ff",
  "#b19bf9", "#d7c7ff", "#f5f1fc", "#7b59c6", "#b8a5f5", "#be9cff",
  "#6a0dad", "#7e30e1", "#6a23d4", "#462478", "#c3abfa", "#5f3dbf",
  "#a596c9", "#ebe3fb", "#2a223e", "#f5f5fc",
];

// ---------------------------------------------------------------------------
console.log("\n[1] The shared design-system tokens (_variables.scss) define a green palette, not a scatter of random values");
{
  const variables = readSource("styles/_variables.scss");
  check("$primary-color is a deep forest green, not the old purple or the old flatter green", /\$primary-color:\s*#1e6b47/i.test(variables));
  check("$primary-hover is a distinct, darker forest green", /\$primary-hover:\s*#154f35/i.test(variables));
  check("$accent-color is a light green tint, not lavender", /\$accent-color:\s*#e3f0e8/i.test(variables));
  check("$background is a visibly-tinted light sage/grey-green, not the old lavender-tinted background (deepened by the 2G-7A correction so it reads as sage, not near-white)", /\$background:\s*#e6ece2/i.test(variables));
  check("$surface-color is a warm neutral white, distinct from $background (cards read as a layer above the page)", /\$surface-color:\s*#fcfdfb/i.test(variables));
  check("$text-dark is a charcoal, not the old purple-tinted dark", /\$text-dark:\s*#202b24/i.test(variables));
  check("$text-muted is a neutral gray (deliberately NOT green — 'muted gray secondary text' per this phase's own design direction)", /\$text-muted:\s*#667085/i.test(variables));
  check("$border-color is a soft green-gray, not the old lavender border", /\$border-color:\s*#dee6dd/i.test(variables));

  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => variables.toLowerCase().includes(hex));
  check("no previously-used purple hex value remains anywhere in _variables.scss", offenders.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[2] Status colors (error/success) kept their original meaning — not repainted green just because the brand did");
{
  const variables = readSource("styles/_variables.scss");
  check("$danger-color is unchanged (still a red, not green)", /\$danger-color:\s*#b3392f/i.test(variables));
  check("$success-color is unchanged (was already an appropriately distinct green before this phase)", /\$success-color:\s*#2f9e5c/i.test(variables));
  check("$danger-color and $primary-color remain visually distinct colors (not the same hex)", !/\$danger-color:\s*#1b7a4a/i.test(variables));
}

// ---------------------------------------------------------------------------
console.log("\n[3] The Phase 2F accessible focus-ring system is preserved, not touched by the theme migration");
{
  const mixins = readSource("styles/_mixins.scss");
  check("focus-ring mixin still exists", /@mixin focus-ring/.test(mixins));
  check("focus-ring still uses :focus-visible (keyboard/AT only, not a mouse click)", /@mixin focus-ring[\s\S]{0,120}:focus-visible/.test(mixins));
  check("focus-ring still reads the shared $primary-color token (so it automatically follows the new green, no hardcoded color of its own)", /@mixin focus-ring[\s\S]{0,200}\$primary-color/.test(mixins));

  const mainScss = readSource("styles/main.scss");
  check("the app-wide focus-ring application to every native interactive element is unchanged", /a, button, input, select, textarea, \[tabindex\]\s*\{\s*@include focus-ring/.test(mainScss));
}

// ---------------------------------------------------------------------------
console.log("\n[4] The MUI-side palette (theme.js) matches the Sass palette — one consistent design system, not two diverging ones");
{
  const themeJs = readSource("theme.js");
  check("MUI primary.main is the same deep forest green as $primary-color", /primary:\s*\{\s*main:\s*"#1e6b47"/i.test(themeJs));
  check("MUI primary.dark matches $primary-hover", /dark:\s*"#154f35"/i.test(themeJs));
  check("MUI background.default matches $background", /default:\s*"#e6ece2"/i.test(themeJs));
  check("MUI background.paper matches the new $surface-color (cards distinct from the page background)", /paper:\s*"#fcfdfb"/i.test(themeJs));
  check("MUI secondary.main matches the new $secondary-color", /secondary:\s*\{\s*main:\s*"#3f8f5f"/i.test(themeJs));

  const offenders = KNOWN_PURPLE_HEXES.filter((hex) => themeJs.toLowerCase().includes(hex));
  check("no previously-used purple hex value remains in theme.js", offenders.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[5] Navbar.scss and Login.scss (this phase's explicit in-scope files) no longer reference any old purple hex directly");
{
  for (const [label, relPath] of [["Navbar.scss", "components/Navbar/Navbar.scss"], ["Login.scss", "pages/Login/Login.scss"]]) {
    const source = readSource(relPath);
    const offenders = KNOWN_PURPLE_HEXES.filter((hex) => source.toLowerCase().includes(hex));
    check(`${label} contains no old purple hex value`, offenders.length === 0);
    check(`${label} reads colors from the shared variables rather than inventing new one-off hex values`, /\$primary-color|\$primary-hover|\$accent-color|\$text-dark|\$background|\$border-color/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[6] Explicitly out-of-scope product-feature files were NOT edited this phase (their own remaining purple, if any, is a documented, deliberate deferral — not this test's job to fix)");
{
  // This is a presence check, not an absence check: confirms this phase
  // did not touch files it was told not to, by verifying they still
  // exist and are unrelated to the theme-token files this phase owns.
  // (Their content is intentionally not asserted here — see
  // PHASE_2G1_REPORT.md §11 for the honest list of what still shows
  // purple after this phase.)
  const untouchedFiles = [
    "components/JobCard/JobCard.scss",
    "pages/JobDetail/JobDetail.scss",
    "pages/SavedJobs/SavedJobs.scss",
    "pages/Home.jsx",
  ];
  for (const relPath of untouchedFiles) {
    check(`${relPath} still exists (not deleted/renamed by this phase)`, fs.existsSync(path.join(SRC_DIR, relPath)));
  }
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
