// Deterministic + static verification for the Phase 2E Profile page:
// utils/profileUi.js#buildProfileUpdates (the pure "only send changed
// fields" decision) and pages/Profile.jsx itself (loads/edits only the
// authenticated caller's own account, never renders a password/hash or
// other internal field, has no fabricated resume-upload control with no
// backend behind it, and routes every request through the centralized
// userApi service). Run via `node src/tests/testProfilePage.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

const { buildProfileUpdates } = await import("../utils/profileUi.js");

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
console.log(" PROFILE PAGE — DETERMINISTIC + STATIC VERIFICATION TESTS");
console.log("============================");

const CURRENT = { name: "Ayushi", email: "ayushi@example.com" };

// ---------------------------------------------------------------------------
console.log("\n[1] buildProfileUpdates — no changes made -> an empty update body (never resends unchanged fields)");
{
  const updates = buildProfileUpdates(CURRENT, { name: "Ayushi", email: "ayushi@example.com" });
  check("no keys present", Object.keys(updates).length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[2] buildProfileUpdates — only the actually-changed field is included");
{
  const nameOnly = buildProfileUpdates(CURRENT, { name: "Ayushi Singh", email: "ayushi@example.com" });
  check("only name is present", Object.keys(nameOnly).length === 1 && nameOnly.name === "Ayushi Singh");

  const emailOnly = buildProfileUpdates(CURRENT, { name: "Ayushi", email: "new@example.com" });
  check("only email is present", Object.keys(emailOnly).length === 1 && emailOnly.email === "new@example.com");
}

// ---------------------------------------------------------------------------
console.log("\n[3] buildProfileUpdates — both fields changed -> both included, matching updateProfile()'s {name?, email?} contract exactly");
{
  const both = buildProfileUpdates(CURRENT, { name: "New Name", email: "new@example.com" });
  check("both keys present with the new values", both.name === "New Name" && both.email === "new@example.com");
  check("no extra/unexpected keys are ever added", Object.keys(both).length === 2);
}

// ---------------------------------------------------------------------------
console.log("\n[4] Profile.jsx never renders a password, password hash, or other internal/sensitive backend field");
{
  const source = readSource("pages/Profile.jsx");
  const forbidden = ["password", "passwordHash", "__v", "dedup_fingerprint"];
  for (const field of forbidden) {
    check(`Profile.jsx does not reference "${field}"`, !new RegExp(`\\b${field}\\b`, "i").test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[5] Profile.jsx has no fabricated resume-upload control (no backend endpoint exists for it — a fake control would just be a second mock)");
{
  const source = readSource("pages/Profile.jsx");
  check("no 'Upload Resume' control remains", !/Upload Resume/i.test(source));
  check("no <input type=\"file\"> remains with nothing real behind it", !/type="file"/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Profile.jsx loads and edits only the authenticated caller's own account through the centralized service layer");
{
  const source = readSource("pages/Profile.jsx");
  check("imports getProfile/updateProfile from services/userApi.js", /getProfile/.test(source) && /updateProfile/.test(source) && /from ["'].*services\/userApi\.js["']/.test(source));
  check("never constructs/sends a userId/ownerId of any kind (identity is the JWT only)", !/userId|ownerId/.test(source));
  check("contains no direct fetch(...) call", !/\bfetch\(/.test(source));
  check("contains no direct axios usage", !/\baxios\b/.test(source));
  check("uses buildProfileUpdates to avoid resending unchanged fields", /buildProfileUpdates/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Profile.jsx shows AuthRequired for a logged-out visitor instead of loading/showing mock data");
{
  const source = readSource("pages/Profile.jsx");
  check("guards on isAuthenticated before rendering the real profile", /isAuthenticated[\s\S]*?<AuthRequired/.test(source));
  check("no hardcoded mock user object remains (e.g. a literal \"ayushi@email.com\" placeholder)", !/ayushi@email\.com/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[8] Profile.jsx surfaces load/save errors safely (the normalized ApiError message), never a raw Axios/Mongo-shaped string");
{
  const source = readSource("pages/Profile.jsx");
  check("no raw axios/Mongo-shaped text is hardcoded into the page", !/AxiosError|CastError|mongodb:\/\//i.test(source));
  check("error text comes from the caught error's own .message (the normalized ApiError), not a stringified object", /err\.message/.test(source));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
