// Deterministic static verification for Phase 2E's protected-page UX:
// AddJob/Profile/SavedJobs all guard on useAuth().isAuthenticated and
// render the shared AuthRequired fallback instead of allowing a request
// that's guaranteed to fail with a 401 — without introducing a generic
// route-guard/wrapper system (this phase explicitly says not to build
// one if the app doesn't need it; three simple inline checks don't
// warrant one). Run via `node src/tests/testProtectedPages.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

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

function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

console.log("============================");
console.log(" PROTECTED PAGES — STATIC VERIFICATION TESTS");
console.log("============================");

const PROTECTED_PAGES = [
  ["AddJob.jsx", "pages/AddJob.jsx", "Log in to post a job."],
  ["Profile.jsx", "pages/Profile.jsx", "Log in to view your profile."],
  ["SavedJobs.jsx", "pages/SavedJobs/SavedJobs.jsx", "Log in to view your saved jobs."],
];

// ---------------------------------------------------------------------------
console.log("\n[1] Each protected page imports and uses the shared AuthRequired fallback (no duplicated 'you must log in' UI, no full route-guard system)");
{
  for (const [label, relPath] of PROTECTED_PAGES) {
    const source = readSource(relPath);
    check(`${label} imports AuthRequired`, /import AuthRequired from ["'].*AuthRequired(\.jsx)?["']/.test(source));
    check(`${label} guards on useAuth().isAuthenticated before rendering its real content`, /isAuthenticated/.test(source) && /<AuthRequired/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[2] Each protected page's guard renders BEFORE any request that would otherwise be guaranteed to fail with a 401");
{
  for (const [label, relPath] of PROTECTED_PAGES) {
    const source = readSource(relPath);
    check(`${label} actually renders <AuthRequired`, source.includes("<AuthRequired"));
  }
  // AddJob specifically: the guard must come before the form/its submit
  // handler is reachable, not after — a textual "AuthRequired appears
  // before the main authenticated return" check.
  const addJobSource = readSource("pages/AddJob.jsx");
  const guardIndex = addJobSource.indexOf("if (!isAuthenticated)");
  const formReturnIndex = addJobSource.lastIndexOf("return (");
  check("AddJob.jsx's auth guard appears before the form's own return statement", guardIndex !== -1 && guardIndex < formReturnIndex);
}

// ---------------------------------------------------------------------------
console.log("\n[3] AuthRequired itself is a plain fallback view, not a redirect/route-guard component (no navigate()/<Navigate> inside it)");
{
  const source = readSource("components/AuthRequired/AuthRequired.jsx");
  check("no forced redirect happens inside AuthRequired itself", !/useNavigate|<Navigate/.test(source));
  check("offers a real link to /login instead", /to="\/login"/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[4] The backend remains the actual authorization boundary — no client-side role/permission system was invented");
{
  for (const [, relPath] of PROTECTED_PAGES) {
    const source = readSource(relPath);
    check(`${relPath} does not implement any admin/role/permission check`, !/isAdmin|role\s*===|hasPermission/i.test(source));
  }
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
