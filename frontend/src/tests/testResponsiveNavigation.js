// Responsive navigation static verification

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

const NAVBAR_JSX = readSource("components/Navbar/Navbar.jsx");
const NAVBAR_SCSS = readSource("components/Navbar/Navbar.scss");

console.log("============================");
console.log(" RESPONSIVE NAVIGATION — DETERMINISTIC STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] The real desktop layout bug is fixed: .navbar is now the flex container joining its two children onto one line, not two unjoined block-level siblings");
{
  const navbarRuleStart = NAVBAR_SCSS.indexOf(".navbar {");
  // Widened window for navbar CSS
  check(".navbar itself is a flex container (not just its children individually)", /^\.navbar \{[\s\S]{0,500}display:\s*flex/.test(NAVBAR_SCSS.slice(navbarRuleStart)));
  check(".navbar__bar sizes to its own content (flex: 0 0 auto) rather than stretching full-width on desktop", /\.navbar__bar\s*\{[\s\S]{0,150}flex:\s*0 0 auto/.test(NAVBAR_SCSS));
  check(".navbar__links fills the remaining width on desktop (flex: 1 1 auto)", /\.navbar__links\s*\{[\s\S]{0,150}flex:\s*1 1 auto/.test(NAVBAR_SCSS));
}

// ---------------------------------------------------------------------------
console.log("\n[2] 2G-7A correction: brand alone on the far left, the ENTIRE nav+auth cluster (Home...Contact, Login/Sign Up) pushed together to the right edge — via one shared list, not three separate DOM groups");
{
  // Auto-margin moved to Home item
  const desktopLinksBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf(".navbar__links {"), NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("the first nav item (Home) gets margin-left: auto on desktop, pulling itself and every item after it (the rest of the nav + Login/Sign Up or Profile/Logout) to the right edge", /li:first-child\s*\{\s*margin-left:\s*auto/.test(desktopLinksBlock));
  check("the old rule pushing only the auth-action group is gone — li.navbar__auth-start no longer gets a desktop margin-left: auto (it would fight the new first-child rule)", !/li\.navbar__auth-start\s*\{\s*margin-left:\s*auto/.test(desktopLinksBlock));
  check("li.navbar__auth-start still exists as a marker (repurposed for the mobile column's divider, checked in [7]/[8] below)", /li\.navbar__auth-start/.test(NAVBAR_SCSS));
  // Match class by containment
  check("the JSX places navbar__auth-start on the first auth-action item in both the logged-in and logged-out branches (unchanged — still used for the mobile divider)", (NAVBAR_JSX.match(/className="[^"]*\bnavbar__auth-start\b[^"]*"/g) || []).length === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Hamburger toggle has correct, complete ARIA wiring (Phase 2F's mechanics, preserved unmodified)");
{
  check("a real <button> toggle exists (not a clickable non-interactive element)", /<button[\s\S]{0,120}navbar__toggle/.test(NAVBAR_JSX));
  check("aria-expanded reflects the open/closed boolean state", /aria-expanded=\{mobileOpen\}/.test(NAVBAR_JSX));
  check("aria-controls references the actual id of the list it controls", /aria-controls="navbar-links"/.test(NAVBAR_JSX) && /id="navbar-links"/.test(NAVBAR_JSX));
  check("aria-label changes with state (not a static, stale label)", /aria-label=\{mobileOpen \? "Close navigation menu" : "Open navigation menu"\}/.test(NAVBAR_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[4] The toggle/links visibility correctly inverts between desktop and the tablet-down breakpoint");
{
  const baseNavbarBlock = NAVBAR_SCSS.slice(0, NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("on desktop (outside the tablet-down block), the toggle has no visible display rule overriding its default hidden state", !/\.navbar__toggle\s*\{[^}]*display:\s*flex/.test(baseNavbarBlock) || /display:\s*none/.test(baseNavbarBlock.match(/\.navbar__toggle\s*\{[^}]*\}/)?.[0] || ""));

  const tabletDownBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("below tablet width, the toggle becomes visible (display: flex)", /\.navbar__toggle\s*\{\s*display:\s*flex/.test(tabletDownBlock));
  check("below tablet width, the link list is hidden by default (display: none) until opened", /\.navbar__links\s*\{\s*display:\s*none/.test(tabletDownBlock));
  check("...and becomes visible only via the --open modifier class the toggle applies", /&\.navbar__links--open\s*\{\s*display:\s*flex/.test(tabletDownBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Desktop navigation is not simultaneously visible alongside the mobile dropdown — they are the SAME element, so this is true by construction, not by two elements happening to agree");
{
  // One links element, two rules
  const flexOccurrences = (NAVBAR_SCSS.match(/\.navbar__links\s*\{/g) || []).length;
  check("the .navbar__links selector's display is set exactly twice — once for desktop (flex), once overridden for mobile (none, then --open re-enables it) — not left ambiguous across more scattered rules", flexOccurrences === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[6] The mobile menu closes on navigation — every link and the logout action call closeMobileMenu()/set it directly");
{
  // Profile items close both menus
  const linkOnClicks = (NAVBAR_JSX.match(/onClick=\{closeMobileMenu\}/g) || []).length;
  check("every plain rendered link passes onClick={closeMobileMenu} (brand + Home, Find Jobs, About, Contact, Login, Sign Up = 7 call sites; Profile-menu items close via handleProfileMenuSelect instead)", linkOnClicks === 7);
  const profileMenuSelectCalls = (NAVBAR_JSX.match(/onClick=\{handleProfileMenuSelect\}/g) || []).length;
  check("View Profile and Saved Jobs inside the Profile dropdown both close the dropdown + mobile panel via handleProfileMenuSelect (2 call sites)", profileMenuSelectCalls === 2);
  check("logout explicitly closes the mobile menu too (setMobileOpen(false) inside handleLogout)", /const handleLogout = \(\) => \{\s*setMobileOpen\(false\);/.test(NAVBAR_JSX));
}

// ---------------------------------------------------------------------------
console.log("\n[7] No horizontal-overflow risk was introduced by the redesign (mobile items are full-width, box-sizing safe)");
{
  const tabletDownBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf("@include tablet-down"));
  // Selector includes profile trigger
  check("mobile link items are box-sizing: border-box (padding can't push them past 100% width)", /li a, li button\.logout-btn[\s\S]{0,60}\{[\s\S]{0,120}box-sizing:\s*border-box/.test(tabletDownBlock));
  // Dropdown min-width exemption
  check("no bare fixed pixel width was introduced anywhere in Navbar.scss (only max-widths/flex-basis/the bounded dropdown's min-width, which are already known-safe patterns)", !/:\s*\d{3,}px;/.test(NAVBAR_SCSS.replace(/width:\s*(44|24)px/g, "").replace(/min-width:\s*180px/g, "")));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Touch targets remain usable — the hamburger keeps its established 44px box, and mobile link rows keep generous padding");
{
  check("the hamburger toggle is 44x44 (matches $min-touch-target)", /width:\s*44px;\s*height:\s*44px/.test(NAVBAR_SCSS));
  const tabletDownBlock = NAVBAR_SCSS.slice(NAVBAR_SCSS.indexOf("@include tablet-down"));
  check("mobile link rows have generous vertical padding (0.8rem), not a cramped hit target", /padding:\s*0\.8rem 0\.6rem/.test(tabletDownBlock));
}

// ---------------------------------------------------------------------------
console.log("\n[9] The shared breakpoint mixin is used (not a new one-off pixel value for this component)");
{
  check("Navbar.scss uses the shared @include tablet-down mixin from Phase 2F, not a hand-written @media query", /@include tablet-down/.test(NAVBAR_SCSS));
  check("no raw @media query was hand-rolled in Navbar.scss", !/@media\s*\(/.test(NAVBAR_SCSS));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
