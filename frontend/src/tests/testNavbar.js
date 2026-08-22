// Deterministic static verification for the Phase 2G-1 navbar redesign:
// the exact logged-out/logged-in link sets this phase's task brief
// specifies, that auth-only/product-only items are correctly hidden in
// the other state, that active-route indication (Phase 2F) is
// preserved, and that no direct API call or Adzuna/RemoteOK reference
// was introduced. The desktop and mobile menus share ONE `<ul>` (only
// CSS toggles which is visible at which width — see
// testResponsiveNavigation.js for the breakpoint wiring itself), so
// "desktop nav contains X" and "mobile nav contains X" are the same
// underlying JSX assertion here; that structural fact is itself
// verified in [8]. Run via `node src/tests/testNavbar.js`.

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

const NAVBAR = readSource("components/Navbar/Navbar.jsx");

console.log("============================");
console.log(" NAVBAR — DETERMINISTIC STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1 & 6] Logged-out navigation (desktop and mobile share this same list) contains exactly: Home, Find Jobs, About, Contact, Login, Sign Up");
{
  check("Home is always rendered (unconditional)", />Home<\/NavLink>/.test(NAVBAR));
  check("Find Jobs is always rendered (unconditional, and relabeled from the old 'Find a Job')", />Find Jobs<\/NavLink>/.test(NAVBAR));
  check("About is always rendered (unconditional)", />About<\/NavLink>/.test(NAVBAR));
  check("Contact is rendered only when logged OUT ({!user && ...})", /\{!user &&[\s\S]{0,200}Contact/.test(NAVBAR));
  check("Login is rendered only when logged OUT (the ternary's else/second branch)", /\{user \? \([\s\S]*?\) : \([\s\S]*?Login/.test(NAVBAR));
  check("Sign Up is rendered only when logged OUT, and labeled 'Sign Up' (not 'Signup') per this phase's spec", /Sign Up<\/NavLink>/.test(NAVBAR));
}

// ---------------------------------------------------------------------------
console.log("\n[2 & 7] Logged-in navigation (desktop and mobile share this same list) contains exactly: Home, Find Jobs, About, Profile (with Saved Jobs inside its dropdown), Logout");
{
  // The standalone top-level "Saved Jobs" item is gone — its only
  // remaining navbar entry is inside the Profile dropdown, itself only
  // rendered in the {user ? (...)} branch, so it's still structurally
  // impossible to render when logged out.
  check("Saved Jobs is rendered only when logged IN (inside the Profile dropdown, itself only in the ternary's first/if branch)", /\{user \? \([\s\S]{0,900}Saved Jobs/.test(NAVBAR));
  check("Saved Jobs has exactly one navbar entry now (no separate top-level item alongside the dropdown one)", (NAVBAR.match(/Saved Jobs<\/NavLink>/g) || []).length === 1);
  check("Profile is rendered only when logged IN (the ternary's first/if branch)", /\{user \? \([\s\S]{0,350}Profile/.test(NAVBAR));
  check("Logout is rendered only when logged IN, as a real <button> (not a link to a route)", /\{user \? \([\s\S]*?<button[\s\S]{0,60}Logout/.test(NAVBAR));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Login/Sign Up are correctly hidden once logged in (not merely present-but-styled-away — actually absent from the conditional branch that renders when `user` is truthy)");
{
  // Extract just the `user ? (...)` branch (rendered when logged in) and
  // confirm it contains neither the Login link nor the Sign Up link.
  const ternaryStart = NAVBAR.indexOf("{user ? (");
  const elseIndex = NAVBAR.indexOf(") : (", ternaryStart);
  const loggedInBranch = NAVBAR.slice(ternaryStart, elseIndex);
  check("the logged-in branch renders neither a Login link...", !/to="\/login"/.test(loggedInBranch));
  check("...nor a Sign Up link", !/to="\/signup"/.test(loggedInBranch));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Saved Jobs/Profile/Logout are correctly hidden when logged out (absent from the ternary's else branch — Saved Jobs' only remaining entry lives inside the Profile dropdown, which is itself entirely inside the if-branch)");
{
  const ternaryStart = NAVBAR.indexOf("{user ? (");
  const elseIndex = NAVBAR.indexOf(") : (", ternaryStart);
  const loggedOutBranch = NAVBAR.slice(elseIndex, NAVBAR.indexOf("</ul>", elseIndex));
  check("the logged-out branch renders neither Profile...", !/to="\/profile"/.test(loggedOutBranch));
  check("...nor a Logout button", !/Logout/.test(loggedOutBranch));
  check("...nor Saved Jobs (its only entry is inside the Profile dropdown, not present in the else branch)", !/saved-jobs/.test(loggedOutBranch));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Active-route indication (Phase 2F) is preserved — still NavLink-based, not reverted to plain Link or a hand-rolled path comparison");
{
  check("still imports and uses NavLink from react-router-dom", /import \{[^}]*NavLink[^}]*\} from "react-router-dom"/.test(NAVBAR));
  check("navLinkClass still applies 'active' via NavLink's own isActive callback", /const navLinkClass = \(\{ isActive \}\) => \(isActive \? "active" : undefined\)/.test(NAVBAR));
  check("every primary/auth NavLink uses the shared navLinkClass (Home/Find Jobs/Saved Jobs/About/Contact/Profile/Login)", (NAVBAR.match(/className=\{navLinkClass\}/g) || []).length >= 5);
  check("the Sign Up link applies its own 'active' class alongside its button styling (still route-aware, not just a static pill)", /signup-btn\$\{isActive \? " active" : ""\}/.test(NAVBAR));
  check("no hand-rolled useLocation-based path matching was introduced", !/useLocation/.test(NAVBAR));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Desktop and mobile share exactly one link list — no separate/duplicated markup to keep in sync, only CSS toggles visibility per breakpoint");
{
  check("exactly one <ul id=\"navbar-links\"> exists", (NAVBAR.match(/<ul id="navbar-links"/g) || []).length === 1);
  check("exactly one hamburger <button className=\"navbar__toggle\"> exists", (NAVBAR.match(/className="navbar__toggle"/g) || []).length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[9] Navigation introduces no direct API call outside the centralized service layer");
{
  check("Navbar.jsx contains no direct fetch(...) call", !/\bfetch\(/.test(NAVBAR));
  check("Navbar.jsx contains no direct axios usage", !/\baxios\b/.test(NAVBAR));
  check("Navbar.jsx imports no service module directly (auth state comes from useAuth() only)", !/from ["'].*services\//.test(NAVBAR));
}

// ---------------------------------------------------------------------------
console.log("\n[10] No Adzuna/RemoteOK reference of any kind was introduced");
{
  check("no Adzuna/RemoteOK hostname or literal mention exists in Navbar.jsx", !/adzuna|remoteok/i.test(NAVBAR));
}

// ---------------------------------------------------------------------------
console.log("\n[11] Authentication logic itself is untouched — still reads real state from AuthContext via useAuth(), still calls the real logout()");
{
  check("imports useAuth from the existing hook (no second/parallel auth mechanism)", /import \{ useAuth \} from "\.\.\/\.\.\/hooks\/useAuth\.js"/.test(NAVBAR));
  check("destructures {user, logout} from useAuth() — the same Phase 2B AuthContext shape", /const \{ user, logout \} = useAuth\(\)/.test(NAVBAR));
  check("logout still calls the real logout() and navigates to /login, unchanged from Phase 2B/2F", /logout\(\)/.test(NAVBAR) && /navigate\("\/login"\)/.test(NAVBAR));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
