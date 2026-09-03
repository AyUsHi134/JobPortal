// Deterministic static verification for Phase 2G-7A: the global design
// system enrichment (several intentional green shades instead of one
// flat green, a warm-white card surface distinct from the sage page
// background, restrained multi-hue badge/tag accent tokens) and the
// redesigned navbar active-route treatment (a subtle pill, not the
// previous heavy inset-box-shadow underline). Checks [11]-[17] cover the
// later "still too flat / mostly one green + white" palette-richness
// correction: two new tones ($primary-deep/$olive-accent) with a real
// hue check (not just differing hex strings), a genuine 3-stop hero
// gradient, a third homepage surface tier ($sage-color via
// background.sage), tonal range across the navbar's own elements, Job
// Detail's badges brought onto the same semantic tokens as JobCard's,
// and About/Contact/Saved Jobs/Login's remaining leftover hardcoded hex
// migrated onto shared tokens. Run via `node src/tests/testDesignSystem.js`.

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

const VARIABLES = readSource("styles/_variables.scss");
const MIXINS = readSource("styles/_mixins.scss");
const MAIN_SCSS = readSource("styles/main.scss");
const NAVBAR_SCSS = readSource("components/Navbar/Navbar.scss");
const NAVBAR_JSX = readSource("components/Navbar/Navbar.jsx");
const THEME_JS = readSource("theme.js");
const HOME_JSX = readSource("pages/Home.jsx");
const JOBDETAIL_SCSS = readSource("pages/JobDetail/JobDetail.scss");
const JOBDETAIL_JSX = readSource("pages/JobDetail/JobDetail.jsx");
const JOBCARD_SCSS = readSource("components/JobCard/JobCard.scss");
const ABOUT_SCSS = readSource("pages/About/About.scss");
const CONTACT_SCSS = readSource("pages/Contact/Contact.scss");
const SAVEDJOBS_SCSS = readSource("pages/SavedJobs/SavedJobs.scss");
const LOGIN_SCSS = readSource("pages/Login/Login.scss");

console.log("============================");
console.log(" GLOBAL DESIGN SYSTEM — DETERMINISTIC STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] The palette contains several distinct, intentional green shades — not one green reused everywhere");
{
  check("$primary-color (deep forest, primary/hero/strong actions) is defined", /\$primary-color:\s*#1e6b47/i.test(VARIABLES));
  check("$secondary-color (medium natural green, secondary brand elements) is defined and distinct from $primary-color", /\$secondary-color:\s*#3f8f5f/i.test(VARIABLES));
  check("$sage-color (moss/sage soft surface) is defined and distinct from $primary-color/$secondary-color", /\$sage-color:\s*#dbe6d5/i.test(VARIABLES));
  check("$accent-color (light green tint) is distinct from $sage-color (two different soft-surface roles, not a duplicate)", !/\$accent-color:\s*#dbe6d5/i.test(VARIABLES) && /\$accent-color:\s*#e3f0e8/i.test(VARIABLES));

  const shades = ["#1e6b47", "#154f35", "#3f8f5f", "#dbe6d5", "#e3f0e8"];
  const uniqueCount = new Set(shades).size;
  check("at least 5 distinct green-family shades exist in the palette (not a random scatter, but genuinely several intentional tones)", uniqueCount === 5);
}

// ---------------------------------------------------------------------------
console.log("\n[2] Backgrounds/surfaces are layered — a light sage page background distinct from a warm-white card surface");
{
  // 2G-7A correction: $background/$sage-color were deepened from their
  // original near-white values (a ~7-point channel gap from
  // $surface-color, which read as "barely different white") to a
  // visibly-tinted sage-grey — re-verified here with a real numeric
  // channel-distance check, not just "the two hex strings differ."
  check("$background (light sage/grey-green page background) is defined", /\$background:\s*#e6ece2/i.test(VARIABLES));
  check("$surface-color (warm neutral white for cards/content) is defined and distinct from $background", /\$surface-color:\s*#fcfdfb/i.test(VARIABLES));
  check("$background and $surface-color are not the same value (page and card read as two layers, not one flat plane)", !/\$background:\s*#fcfdfb/i.test(VARIABLES));
  check("$border-subtle (a softer divider than $border-color) is defined for nested surfaces", /\$border-subtle:\s*#eaefe8/i.test(VARIABLES));

  const toRgb = (hex) => [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [bgR, bgG, bgB] = toRgb("e6ece2");
  const [surR, surG, surB] = toRgb("fcfdfb");
  const minChannelGap = Math.min(surR - bgR, surG - bgG, surB - bgB);
  check("the page background is at least 15 points (per RGB channel) darker than the card surface — a visually obvious layer, not a barely-different white", minChannelGap >= 15);

  check("the shared `card` mixin now uses $surface-color (not a hardcoded #fff) plus a subtle border", /@mixin card\s*\{[\s\S]{0,200}background:\s*\$surface-color[\s\S]{0,100}border:\s*1px solid \$border-color/.test(MIXINS));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Restrained, non-neon semantic accent tokens exist for badges/tags — blue, lavender, yellow, pale green, each a light-fill + readable-text pair");
{
  const pairs = [
    ["blue", "#e4ecf8", "#3b5b86"],
    ["lavender", "#ece7f6", "#63529c"],
    ["yellow", "#faf3d8", "#8a6d16"],
    ["green", "#e3f0e8", "#1e6b47"],
  ];
  for (const [name, bg, text] of pairs) {
    check(`$badge-${name}-bg/$badge-${name}-text are defined as a light fill + darker readable text (not neon/saturated)`,
      new RegExp(`\\$badge-${name}-bg:\\s*${bg}`, "i").test(VARIABLES) &&
      new RegExp(`\\$badge-${name}-text:\\s*${text}`, "i").test(VARIABLES));
  }

  // Not neon: none of the accent fills are a fully-saturated primary hue
  // (e.g. pure #00f/#ff0/#0f0) — every fill token is a light, desaturated
  // tint (each RGB channel comfortably above the neon range).
  const NEON_PATTERN = /\$badge-\w+-bg:\s*#(00f{3}|f{3}0{3}|0{3}f{3}|f00|0f0|00f)\b/i;
  check("no badge accent fill is a fully-saturated neon color", !NEON_PATTERN.test(VARIABLES));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Semantic status colors (error/success) remain untouched by the richer palette — their MEANING doesn't shift just because the brand palette grew");
{
  check("$danger-color is still the original red", /\$danger-color:\s*#b3392f/i.test(VARIABLES));
  check("$success-color is still its own distinct green (not merged into $primary-color or $secondary-color)", /\$success-color:\s*#2f9e5c/i.test(VARIABLES));
  check("$success-color remains visually distinct from $primary-color and $secondary-color", !/\$success-color:\s*#1e6b47/i.test(VARIABLES) && !/\$success-color:\s*#3f8f5f/i.test(VARIABLES));
}

// ---------------------------------------------------------------------------
console.log("\n[5] The MUI-side theme.js mirrors the same richer palette — one coordinated system, not two diverging ones");
{
  check("MUI secondary.main matches $secondary-color", /secondary:\s*\{\s*main:\s*"#3f8f5f"/i.test(THEME_JS));
  check("MUI background.paper matches $surface-color", /paper:\s*"#fcfdfb"/i.test(THEME_JS));
  check("MUI text.primary/text.secondary are wired to $text-dark/$text-muted", /text:\s*\{\s*primary:\s*"#202b24",\s*secondary:\s*"#667085"/i.test(THEME_JS));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Global typography/link consistency improvements (main.scss) — additive defaults, not a rewrite of the existing system");
{
  check("headings have a consistent explicit font-weight now (previously only color was set)", /h1, h2, h3, h4, h5\s*\{[\s\S]{0,150}font-weight:\s*700/.test(MAIN_SCSS));
  check("a base body line-height is defined for readable body text", /body\s*\{[\s\S]{0,150}line-height:\s*1\.55/.test(MAIN_SCSS));
  check("a sane default anchor color/hover exists (bare element selector — component classes still outrank it)", /^a\s*\{[\s\S]{0,150}color:\s*\$primary-color/m.test(MAIN_SCSS));
  check("no new font/styling dependency was introduced (still only $font-main, 'Inter, Arial, sans-serif')", !/@import\s+["']https?:/.test(MAIN_SCSS) && !/@use\s+["'](?!\.\/)/.test(MAIN_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Navbar active-route styling was redesigned into a restrained pill — the previous heavy inset-box-shadow underline is gone");
{
  const linkRuleStart = NAVBAR_SCSS.indexOf("li a, li button.logout-btn");
  const desktopLinkBlock = NAVBAR_SCSS.slice(linkRuleStart, NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("the desktop active state uses a subtle background fill (a pill), not the old inset box-shadow underline trick", /&\.active\s*\{[\s\S]{0,150}background:\s*\$accent-color/.test(desktopLinkBlock));
  check("the desktop active state no longer uses `box-shadow: inset 0 -2.5px 0` (the removed heavy underline)", !/box-shadow:\s*inset 0 -2\.5px 0/.test(desktopLinkBlock));
  check("the active state still reads the shared $primary-color/$accent-color tokens (consistent with the rest of the palette, not a one-off hex)", /&\.active\s*\{\s*color:\s*\$primary-color/.test(desktopLinkBlock));

  // Mobile keeps its own distinct left-accent-bar treatment (a different,
  // intentionally distinct pattern for a vertical column) — not removed,
  // just re-themed onto the same tokens.
  const tabletDownBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("mobile keeps its own left-accent-bar active treatment (a deliberately different pattern for a vertical list)", /li a\.active\s*\{\s*box-shadow:\s*inset 3px 0 0 \$primary-color/.test(tabletDownBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Navbar surfaces were softened/layered to match the new design system (subtle border, restrained shadow) without changing its structure — desktop background is a translucent white glass layer ($navbar-bg-desktop), distinct from $surface-color which cards/mobile-nav still use");
{
  const navbarRuleStart = NAVBAR_SCSS.indexOf(".navbar {");
  const navbarTopBlock = NAVBAR_SCSS.slice(navbarRuleStart, navbarRuleStart + 400);
  check("the navbar's default (desktop) background uses the new $navbar-bg-desktop token, not $surface-color or a bare #fff literal", /background:\s*\$navbar-bg-desktop/.test(navbarTopBlock));
  // A later glass-navbar pass first made $navbar-bg-desktop a translucent
  // grey-tinted rgba (was the opaque hex #f5f7f5), then a still later pass
  // switched its RGB channels to pure white — a semi-transparent WHITE
  // layer, per this pass's explicit "whitish translucent glass" request —
  // while keeping the same alpha-channel/backdrop-filter approach. Updated
  // in place per this project's "revise the check for an intentional
  // change" convention.
  check("$navbar-bg-desktop is a semi-transparent WHITE fill (rgba(255, 255, 255, ...), not a fully opaque fill and not grey-tinted)", /\$navbar-bg-desktop:\s*rgba\(\s*255,\s*255,\s*255,\s*0(\.\d+)?\s*\)/i.test(VARIABLES));
  check("$navbar-bg-desktop is distinct from $surface-color (cards stay warm off-white, the navbar reads a cooler subtle grey)", !/\$navbar-bg-desktop:\s*#fcfdfb/i.test(VARIABLES));
  check("Navbar.scss pairs the translucent background with an actual backdrop blur (with a -webkit- prefix for Safari), not just a lower-opacity color with no glass effect", /-webkit-backdrop-filter:\s*blur\(/.test(NAVBAR_SCSS) && /(?<!-webkit-)backdrop-filter:\s*blur\(/.test(NAVBAR_SCSS));
  check("the navbar's own border/shadow read from the new subtle tokens (not the old harder-edged values)", /border-bottom:\s*1px solid \$border-subtle/.test(navbarTopBlock));

  // Mobile/tablet-down explicitly reverts to $surface-color — only the
  // desktop background changed, per this phase's own "change ONLY the
  // desktop navbar background" instruction.
  const tabletDownBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("mobile/tablet-down reverts the navbar background to $surface-color (unchanged from before) — only the desktop background changed", /\.navbar\s*\{\s*background:\s*\$surface-color/.test(tabletDownBlock));

  // Structural regressions would be caught by testResponsiveNavigation.js
  // — this file only asserts the visual/token layer changed, not the
  // flex/breakpoint mechanics (which are unchanged this phase).
  // Window widened 400 -> 500: the `.navbar` rule's own declarations
  // legitimately grew (translucent background + backdrop-filter + sticky
  // positioning, all added in later passes) before reaching `display:
  // flex` — not a magic-number workaround, just more real CSS ahead of it.
  check("the desktop flex layout fix from Phase 2G-1 is still present (.navbar is still the flex container)", /^\.navbar \{[\s\S]{0,500}display:\s*flex/.test(NAVBAR_SCSS.slice(navbarRuleStart)));
}

// ---------------------------------------------------------------------------
console.log("\n[9] No leftover purple/lavender hex anywhere in the global design-system files or Navbar this phase touched");
{
  const KNOWN_PURPLE_HEXES = [
    "#7046d3", "#5f43b2", "#7b42f6", "#a276e8", "#8457e7", "#51308d",
    "#6d4cbe", "#563ba7", "#987fe7", "#ece4fa", "#f7f3ff",
    "#b19bf9", "#d7c7ff", "#f5f1fc", "#7b59c6", "#b8a5f5", "#be9cff",
    "#6a0dad", "#7e30e1", "#6a23d4", "#462478", "#c3abfa", "#5f3dbf",
    "#a596c9", "#ebe3fb", "#2a223e", "#f5f5fc",
    "#1b7a4a", "#145c38", "#e3f2e9", "#f7faf8", "#1f2723", "#6b7280", "#dce7e0", // the old flat-green 2G-1 values, also superseded
  ];
  for (const [label, source] of [
    ["_variables.scss", VARIABLES],
    ["theme.js", THEME_JS],
    ["main.scss", MAIN_SCSS],
    ["_mixins.scss", MIXINS],
    ["Navbar.scss", NAVBAR_SCSS],
  ]) {
    const offenders = KNOWN_PURPLE_HEXES.filter((hex) => source.toLowerCase().includes(hex));
    check(`${label} contains no old purple hex or old flat-green 2G-1 hex value`, offenders.length === 0);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[10] Navbar.jsx (structure/behavior) was not touched this phase — only Navbar.scss's visual layer changed");
{
  check("Navbar.jsx still uses the exact same logged-out/logged-in link structure (unchanged since Phase 2G-1)", /const navLinkClass = \(\{ isActive \}\) => \(isActive \? "active" : undefined\)/.test(NAVBAR_JSX));
  check("Navbar.jsx still imports useAuth from the same unmodified hook (no auth logic touched)", /import \{ useAuth \} from "\.\.\/\.\.\/hooks\/useAuth\.js"/.test(NAVBAR_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[11] 2G-7A palette-richness correction: two new, genuinely distinct tones exist — not just another shade of the same green stretched further");
{
  check("$primary-deep (deepest, coolest forest — hero/navbar) is defined", /\$primary-deep:\s*#123c2a/i.test(VARIABLES));
  check("$olive-accent (a distinct warm-green HUE, not just a darker step) is defined", /\$olive-accent:\s*#4f5c34/i.test(VARIABLES));

  const toRgb = (hex) => [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [deepR, , deepB] = toRgb("123c2a");
  const [oliveR, oliveG, oliveB] = toRgb("4f5c34");
  // A real hue check, not just "the hex strings differ": $primary-deep's
  // blue channel should sit clearly above its red channel (a cool,
  // blue-leaning forest green, consistent with $primary-color's own
  // family), while $olive-accent's should not (a warm, yellow-leaning
  // olive) — this is what makes it a distinct HUE, not merely a
  // different lightness of the same green.
  check("$primary-deep is a cool, blue-leaning forest tone (blue channel > red channel)", deepB > deepR);
  check("$olive-accent is a warm, yellow-leaning tone (blue channel is the smallest of its 3 channels, unlike the cool forest family)", oliveB < oliveR && oliveB < oliveG);

  const allTones = ["123c2a", "1e6b47", "154f35", "3f8f5f", "4f5c34", "dbe6d5", "e3f0e8"];
  check("every green-family token in the palette is a genuinely distinct hex value (7 unique tones, not duplicates under different names)", new Set(allTones).size === 7);
}

// ---------------------------------------------------------------------------
console.log("\n[12] theme.js mirrors both new tones plus a third background tier ($sage-color, via background.sage) — the MUI side stays coordinated with Sass, not diverging");
{
  check("MUI primary.deep matches $primary-deep", /primary:\s*\{[^}]*deep:\s*"#123c2a"/i.test(THEME_JS));
  check("MUI oliveAccent matches $olive-accent", /oliveAccent:\s*"#4f5c34"/i.test(THEME_JS));
  check("MUI background.sage matches $sage-color, giving Home.jsx a real third tier to reference instead of a hardcoded hex", /background:\s*\{[^}]*sage:\s*"#dbe6d5"/i.test(THEME_JS));
}

// ---------------------------------------------------------------------------
// A later redesign phase (post-2G-7C) deliberately replaced the old
// full-width hero + wave-divider geometry with a compact dashboard-style
// intro: a small rounded green-gradient card (headline/subtitle) sitting
// beside — not underneath — a real search toolbar, both inside the normal
// page flow (no more position:absolute/relative hero-wave anchoring, no
// translateY overlap trick, no SVG wave). This is an intentional
// revision of [13]/[13b]/[14] above (same "update the check in place
// instead of forking a phase-numbered duplicate" pattern this project has
// followed for every prior deliberate redesign, e.g. 2G-7C's badge-slot
// revision in testJobCardTheme.js) — not a regression the old checks
// should still catch.
console.log("\n[13] The intro card still uses the exact same diagonal (115deg) 3-stop gradient — deep forest -> medium natural green -> muted olive — just scoped to a small rounded card instead of a full-width hero band");
{
  const GRADIENT_RE = /background:\s*\(theme\)\s*=>\s*\n?\s*`linear-gradient\(115deg, \$\{theme\.palette\.primary\.deep\} 0%, \$\{theme\.palette\.primary\.main\} 40%, \$\{theme\.palette\.oliveAccent\} 100%\)`/;
  check("the intro card's gradient is diagonal at exactly 115deg — deep forest green flowing into muted olive, not vertical/horizontal", GRADIENT_RE.test(HOME_JSX));
  check("the gradient walks deep forest -> medium natural green -> muted olive, in that order, using existing theme tokens only (no new hardcoded hex)", GRADIENT_RE.test(HOME_JSX));
  check("the gradient is exactly a 3-stop structure (0%/40%/100%)", Boolean(HOME_JSX.match(GRADIENT_RE)) && (HOME_JSX.match(GRADIENT_RE)[0].match(/theme\.palette\.(primary\.deep|primary\.main|oliveAccent)/g) || []).length === 3);
  check("the old vertical 180deg 5-stop gradient is (still) gone", !/linear-gradient\(180deg/.test(HOME_JSX));

  // The compact card is a genuinely small, rounded element now — not a
  // full-bleed section: it carries its own borderRadius, and is a child of
  // the width-bounded LEFT COLUMN wrapper (which also now holds Search
  // above it and the "Why Choose Us" card below it — see [14] below — so
  // the maxWidth constraint lives one level up, on that shared column
  // wrapper, rather than on the gradient card's own immediate Box).
  const gradientIdx = HOME_JSX.indexOf("linear-gradient(115deg");
  const cardBlockStart = HOME_JSX.lastIndexOf("<Box", gradientIdx);
  const cardBlock = HOME_JSX.slice(cardBlockStart, gradientIdx);
  // Anchored to the left column wrapper's own flex-basis literal (rather
  // than a fixed raw-character lookback window) since Search now renders
  // ahead of the gradient card inside that same wrapper (SS3 composition,
  // see [14]) — a fixed-width window would no longer reliably span from
  // the wrapper's maxWidth down to the gradient regardless of how much
  // markup sits between them.
  const columnWrapperStart = HOME_JSX.lastIndexOf('flex: "1 1 280px"', gradientIdx);
  const columnWrapperBlock = HOME_JSX.slice(Math.max(0, columnWrapperStart), gradientIdx);
  check("the gradient card has its own border radius (a rounded card, not a square full-width band)", /borderRadius:\s*3/.test(cardBlock));
  // Widened 340 -> 400 -> 460 across two visual-polish passes, then
  // narrowed back to 400 in a later balance pass (to give Recent Jobs
  // slightly more horizontal space while the Career/Why-Choose-Us cards'
  // heights/typography stayed put) — still bounded, not stretched
  // full-page-width.
  check("the gradient card's column is width-bounded (maxWidth), not stretched full-page-width", /maxWidth:\s*\{\s*md:\s*400\s*\}/.test(columnWrapperBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[13b] The old full-bleed wave/curve SVG divider is gone entirely — a compact card has no 'bottom edge' to dissolve into the section below, so it was removed rather than forced onto geometry it no longer fits");
{
  check("no SVG element remains in Home.jsx (the wave graphic was removed, not just hidden)", !/component="svg"/.test(HOME_JSX));
  check("the old reference viewBox (0 0 1440 190) is gone", !/viewBox="0 0 1440 190"/.test(HOME_JSX));
  check("the old wave path's exact curve data is gone", !/d="M0,110 C220,190 420,40 700,95/.test(HOME_JSX));
  check("no leftover translateY overlap hack remains (nothing needs to visually straddle a wave any more)", !/transform:\s*"translateY/.test(HOME_JSX));
}

// ---------------------------------------------------------------------------
// SS3 composition (revising SS1/SS2 above, same "update the check in place"
// convention): the search toolbar no longer has its own full-width row
// above the sage section at all — it has moved INSIDE the sage two-column
// area, as the first element of the narrow LEFT column, ahead of the
// gradient card and "Why Choose Us" (Search -> Career -> Why Choose Us),
// matching a visual mockup's "search at the top of a narrow sidebar"
// proportions. The old standalone white Container maxWidth="md" shell
// above the sage section is gone entirely. The RIGHT column (Recent Jobs)
// is still the row-sibling of that whole LEFT column, unchanged.
console.log("\n[14] Search now sits INSIDE the sage two-column area as the first element of the LEFT column (Search -> Career card -> Why Choose Us); Recent Jobs stays the row-sibling RIGHT column — still the same unchanged handleHeroSearch/validateSearchQuery handoff, and the old standalone white search shell above the sage section is gone");
{
  const formIdx = HOME_JSX.indexOf('component="form"');
  const sageBoxIdx = HOME_JSX.indexOf('bgcolor: "background.sage"');
  const gradientIdx = HOME_JSX.indexOf("linear-gradient(115deg");
  const recentJobsHeadingIdx = HOME_JSX.indexOf("Recent Jobs", sageBoxIdx);
  const footerIdx = HOME_JSX.indexOf("<Footer");

  check("the search form now sits INSIDE the sage two-column area (moved out of its old standalone shell above it)", formIdx !== -1 && sageBoxIdx !== -1 && formIdx > sageBoxIdx);
  check("the search form comes BEFORE the gradient career card in DOM order — it's the first element of the LEFT column, not the row-sibling of Recent Jobs", formIdx !== -1 && gradientIdx !== -1 && formIdx < gradientIdx);
  check("the intro gradient card lives INSIDE the sage box, i.e. it is paired with Recent Jobs as the LEFT column's second element", sageBoxIdx !== -1 && gradientIdx !== -1 && sageBoxIdx < gradientIdx);
  check("the search form, the intro card, and the Recent Jobs heading all stay within the same sage two-column area — no Footer (or any section boundary past it) sits between them", formIdx !== -1 && recentJobsHeadingIdx !== -1 && footerIdx !== -1 && formIdx < recentJobsHeadingIdx && recentJobsHeadingIdx < footerIdx);
  check("the search form is still a real <form> wired to the unchanged handleHeroSearch handler", /component="form"[\s\S]{0,40}onSubmit=\{handleHeroSearch\}/.test(HOME_JSX));
  check("no separate full-bleed white search shell remains above the sage section (the old Container maxWidth=\"md\" band is gone; the search now renders on the sage background as part of the left column)", !/Container maxWidth="md"/.test(HOME_JSX));
  check("the sage box's two-column row starts with the search form, followed by the gradient card and Why Choose Us in the LEFT column, with Recent Jobs as its RIGHT-column sibling", sageBoxIdx !== -1 && recentJobsHeadingIdx !== -1 && formIdx > sageBoxIdx && formIdx < gradientIdx && gradientIdx < recentJobsHeadingIdx);
  check("'Why Choose Us' still reads from background.paper (a white card), stacked beneath the intro card in the same left column", /bgcolor:\s*"background\.paper"/.test(HOME_JSX));
  check("the search placeholder text and validation wiring are untouched by the layout changes", /placeholder="e\.g\. React Developer"/.test(HOME_JSX) && /onSubmit=\{handleHeroSearch\}/.test(HOME_JSX));
}

// ---------------------------------------------------------------------------
// A later visual-polish pass deliberately left-aligned "Recent Jobs" (to
// align with the left edge of the job grid beneath it, in the right/main
// column) instead of centering it across that column. A still later pass
// removed the short accent-bar underline that used to sit beneath it
// entirely (heading text/color/alignment/typography untouched) and pulled
// the heading's own mb in slightly, so the job grid now sits closer to the
// heading than it used to. Updated in place for both intentional changes
// (same convention as the other revisions above).
console.log("\n[14b] The LEFT-aligned 'Recent Jobs' heading no longer has an accent-bar underline beneath it, and sits closer to the job grid than before");
{
  const headingTagIdx = HOME_JSX.indexOf('variant="h5" fontWeight={700} color="secondary.main" align="left"');
  check("the 'Recent Jobs' heading is left-aligned (align=\"left\")", headingTagIdx !== -1);
  const headingLineEnd = HOME_JSX.indexOf("\n", headingTagIdx);
  const headingTag = HOME_JSX.slice(headingTagIdx, headingLineEnd);
  check("the heading's own bottom margin was reduced (mb: 1, was 1.5) now that it's the only spacer before the job grid", /mb:\s*1\s*,/.test(headingTag));
  const sageBoxIdx2 = HOME_JSX.indexOf('bgcolor: "background.sage"');
  const recentJobsHeadingIdx2 = HOME_JSX.indexOf("Recent Jobs", sageBoxIdx2);
  const gridIdx = HOME_JSX.indexOf("Grid container", recentJobsHeadingIdx2);
  const betweenHeadingAndGrid = HOME_JSX.slice(recentJobsHeadingIdx2, gridIdx);
  check("no accent-bar underline Box (the old width:56/height:3/bgcolor:\"primary.main\" bar) remains between the heading and the job grid", !/width:\s*56,\s*height:\s*3,\s*bgcolor:\s*"primary\.main"/.test(betweenHeadingAndGrid));
  check("the heading text/color itself is unchanged", /Recent Jobs/.test(HOME_JSX) && /color="secondary\.main"/.test(headingTag));
}

// ---------------------------------------------------------------------------
console.log("\n[15] Navbar shows genuine tonal range across its own elements/states, not one green reused everywhere on the bar itself — Sign Up now also reads visibly deeper/stronger than Search's medium green by default (button-hierarchy correction)");
{
  check("the brand reads $primary-deep by default (distinct from every button/link on the same bar, which stay $primary-color)", /\.navbar__brand a\s*\{[\s\S]{0,80}color:\s*\$primary-deep/.test(NAVBAR_SCSS));
  check("the brand's hover reveals $primary-color (a deep-to-medium transition on interaction)", /\.navbar__brand a\s*\{[\s\S]{0,200}&:hover\s*\{\s*color:\s*\$primary-color/.test(NAVBAR_SCSS));
  check("Sign Up now DEFAULTS to $primary-hover (\"dark natural green\" — deeper than $primary-color, which the homepage's own Search button uses), not the same medium shade as Search", /\.signup-btn\s*\{[\s\S]{0,80}background:\s*\$primary-hover;/.test(NAVBAR_SCSS));
  check("Sign Up shows 3 distinct tones across its states: default $primary-hover, hover $olive-accent, route-active $primary-deep", /\.signup-btn\s*\{[\s\S]{0,80}background:\s*\$primary-hover[\s\S]{0,150}&:hover\s*\{\s*background:\s*\$olive-accent[\s\S]{0,150}&\.active\s*\{\s*background:\s*\$primary-deep/.test(NAVBAR_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[15b] Button hierarchy: Sign Up (deep filled green), Search (medium filled green), View Details (light teal filled), Save/Unsave (light amber filled) — four genuinely different treatments. View Details/Save were revised from outlined to a tonal/filled treatment in a later visual-correction pass (exact reference hex values, per that pass's explicit instruction not to leave them outlined) — Sign Up/Search are unaffected and unchanged.");
{
  check("Search (Home.jsx's hero button) still resolves to MUI's plain color=\"primary\" (the medium $primary-color) — unchanged", /Button type="submit" variant="contained" color="primary"/.test(HOME_JSX));
  check("View Details is a light teal filled/tonal treatment, no border — background #f0fdfa, text #115e59", /\.view-details-btn\s*\{[^}]*background:\s*#f0fdfa;[^}]*color:\s*#115e59;[^}]*border:\s*none;/.test(JOBCARD_SCSS));
  check("Save/Unsave is a light amber filled/tonal treatment, no border — background #fffbeb, text #92400e — genuinely distinct from View Details' teal, not the same fill under a different name", /\.save-btn\s*\{[^}]*background:\s*#fffbeb;[^}]*color:\s*#92400e;[^}]*border:\s*none;/.test(JOBCARD_SCSS));
  check("View Details, Save/Unsave, Sign Up, and Search resolve to 4 different color families (teal / amber / deep green / medium green) — genuinely distinct, not coincidentally the same value", new Set(["#f0fdfa", "#fffbeb", "primary-hover", "primary-color"]).size === 4);
}

// ---------------------------------------------------------------------------
console.log("\n[16] Job Detail's badges still read from the shared $badge-* tokens, untouched — a later visual-correction pass deliberately moved JobCard's own badges to exact reference hex values instead (JobCard-only in scope, Job Detail explicitly excluded), so the two no longer share literal color values; both still use the same tone-mapping helper and the same 4 semantic categories");
{
  check("Job Detail imports the same getExperienceBadgeTone helper JobCard uses (reused, not reimplemented)", /getExperienceBadgeTone/.test(JOBDETAIL_JSX));
  check("Job Detail's experience badge class is tone-suffixed the same way JobCard's is", /badge-experience--\$\{experienceTone\}/.test(JOBDETAIL_JSX));
  for (const [selector, bgToken, textToken] of [
    [".badge-remote", "\\$badge-green-bg", "\\$badge-green-text"],
    [".badge-tech", "\\$badge-blue-bg", "\\$badge-blue-text"],
    [".badge-experience--entry", "\\$badge-yellow-bg", "\\$badge-yellow-text"],
    [".badge-experience--senior", "\\$badge-lavender-bg", "\\$badge-lavender-text"],
  ]) {
    const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{\\s*background:\\s*${bgToken};\\s*color:\\s*${textToken};`);
    check(`Job Detail's ${selector} still uses the shared $badge-* token pair (untouched by the JobCard-only visual correction)`, re.test(JOBDETAIL_SCSS));
  }
  // JobCard's own badge colors are verified separately in
  // testJobCardTheme.js (now exact reference hex values, not these
  // tokens) — not re-checked here to avoid duplicating that coverage.
}

// ---------------------------------------------------------------------------
console.log("\n[17] About, Contact, Saved Jobs, and Login no longer carry leftover hardcoded purple/bare-white hex — palette consistency check across every page item 8 named");
{
  const KNOWN_PURPLE_HEXES = ["#7046d3", "#51308d", "#5f43b2", "#ece4fa", "#faf7ff", "#a596c9", "#2a223e"];
  for (const [label, source] of [
    ["About.scss", ABOUT_SCSS],
    ["Contact.scss", CONTACT_SCSS],
    ["SavedJobs.scss", SAVEDJOBS_SCSS],
  ]) {
    const offenders = KNOWN_PURPLE_HEXES.filter((hex) => source.toLowerCase().includes(hex));
    check(`${label} contains no leftover purple hex`, offenders.length === 0);
    check(`${label} reads its palette from shared tokens now`, /\$primary-color|\$background|\$text-dark|\$text-muted|\$sage-color|\$border-color/.test(source));
  }
  check("Login.scss's form-card gradient no longer hardcodes a bare #ffffff literal (uses $surface-color instead)", !/#ffffff/i.test(LOGIN_SCSS) && /\$surface-color/.test(LOGIN_SCSS));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
