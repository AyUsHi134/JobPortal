// Deterministic verification for the Phase 1I-4 save-job authorization
// fixes (`POST /api/user/savejob`, `POST /api/user/issaved`). No MongoDB
// connection is opened and no live HTTP server is started —
// controllers/user.js's `deps` injection seam supplies a mocked User
// model, and `req.user` is set directly on the fake request the way
// authMiddleware would set it from a verified JWT (never from
// req.body), exactly matching how these handlers actually run in
// production behind that middleware.
//
// Run via: node backend/scripts/testSaveJobs.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveJobHandler, createIsJobSavedHandler } from "../controllers/user.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// Simulates authMiddleware already having run: req.user is ALWAYS set
// from a verified token, never from req.body.
function authedReq(userId, body) {
  return { user: { id: userId }, body };
}

const VALID_JOB_ID_1 = "60f7c2b5c1234567890000aa";
const VALID_JOB_ID_2 = "60f7c2b5c1234567890000bb";
const SELF_ID = "6a0000000000000000000001";
const OTHER_USER_ID = "6a0000000000000000000002";

// A small multi-user in-memory fake User "collection" — findById(id)
// returns a mutable record keyed by id, each with a real-shaped
// savedJobs array and a `.save()` that just resolves.
function makeFakeUserStore(records) {
  const findByIdCalls = [];
  const UserModel = {
    findById: async (id) => {
      findByIdCalls.push(id);
      const record = records[id];
      if (!record) return null;
      return {
        ...record,
        save: async function () {
          records[id].savedJobs = this.savedJobs;
          return this;
        },
      };
    },
  };
  return { UserModel, findByIdCalls, records };
}

console.log("============================");
console.log(" SAVE-JOB AUTHORIZATION — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[S1] An authenticated user can save a job to their own account");
{
  const { UserModel, records } = makeFakeUserStore({ [SELF_ID]: { _id: SELF_ID, savedJobs: [] } });
  const handler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1 }), res);

  check("HTTP 200", res.statusCode === 200);
  check("success: true", res.body.success === true);
  check("the job was actually added to the caller's own savedJobs", records[SELF_ID].savedJobs.includes(VALID_JOB_ID_1));
}

// ---------------------------------------------------------------------------
console.log("\n[S2] A user CANNOT save a job onto another user's account, even if they supply that user's id");
{
  const { UserModel, records, findByIdCalls } = makeFakeUserStore({
    [SELF_ID]: { _id: SELF_ID, savedJobs: [] },
    [OTHER_USER_ID]: { _id: OTHER_USER_ID, savedJobs: [] },
  });
  const handler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  // The authenticated caller is SELF_ID, but the request body tries to
  // smuggle in OTHER_USER_ID the way the pre-fix API accepted `userId`
  // straight from the client.
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1, userId: OTHER_USER_ID }), res);

  check("HTTP 200 (the request succeeds, but only against the caller's own account)", res.statusCode === 200);
  check("only the authenticated caller's id was ever looked up — the body's userId was never used", findByIdCalls.length === 1 && findByIdCalls[0] === SELF_ID);
  check("the job was added to the CALLER's list", records[SELF_ID].savedJobs.includes(VALID_JOB_ID_1));
  check("the OTHER user's saved-jobs list was never touched", records[OTHER_USER_ID].savedJobs.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[S3] A user CANNOT read another user's saved-job state via isJobSaved");
{
  const { UserModel, findByIdCalls } = makeFakeUserStore({
    [SELF_ID]: { _id: SELF_ID, savedJobs: [] },
    [OTHER_USER_ID]: { _id: OTHER_USER_ID, savedJobs: [VALID_JOB_ID_1] },
  });
  const handler = createIsJobSavedHandler({ User: UserModel });
  const res = fakeRes();
  // The caller is SELF_ID (who has NOT saved this job); OTHER_USER_ID
  // (who HAS) is smuggled into the body exactly as the pre-fix API
  // accepted it.
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1, userId: OTHER_USER_ID }), res);

  check("the response reflects the CALLER's own state (false), not the other user's (true)", res.body.isSaved === false);
  check("only the authenticated caller's id was ever looked up", findByIdCalls.length === 1 && findByIdCalls[0] === SELF_ID);
}

// ---------------------------------------------------------------------------
console.log("\n[S4] Saving an already-saved job does not duplicate it (dedup fix)");
{
  const { UserModel, records } = makeFakeUserStore({ [SELF_ID]: { _id: SELF_ID, savedJobs: [VALID_JOB_ID_1] } });
  const handler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1 }), res);

  check("the job appears exactly once, not twice", records[SELF_ID].savedJobs.filter((id) => id === VALID_JOB_ID_1).length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[S5] isJobSaved correctly reports true for an actually-saved job (comparison fix)");
{
  const { UserModel } = makeFakeUserStore({ [SELF_ID]: { _id: SELF_ID, savedJobs: [VALID_JOB_ID_1, VALID_JOB_ID_2] } });
  const handler = createIsJobSavedHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_2 }), res);

  check("isSaved is true for a job that really is in the user's list", res.body.isSaved === true);
}

// ---------------------------------------------------------------------------
console.log("\n[S6] Malformed job ids are rejected with 400, not passed through to the database");
{
  for (const badJobId of ["abc", "", "not-an-id", "../../etc/passwd"]) {
    const { UserModel, findByIdCalls } = makeFakeUserStore({ [SELF_ID]: { _id: SELF_ID, savedJobs: [] } });
    const saveHandler = createSaveJobHandler({ User: UserModel });
    const isSavedHandler = createIsJobSavedHandler({ User: UserModel });

    const res1 = fakeRes();
    await saveHandler(authedReq(SELF_ID, { jobId: badJobId }), res1);
    check(`saveJob: "${badJobId}" → HTTP 400`, res1.statusCode === 400);

    const res2 = fakeRes();
    await isSavedHandler(authedReq(SELF_ID, { jobId: badJobId }), res2);
    check(`isJobSaved: "${badJobId}" → HTTP 400`, res2.statusCode === 400);

    check(`"${badJobId}" never reached the database layer`, findByIdCalls.length === 0);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[S7] A nonexistent authenticated user id (edge case) returns 404, not a crash or a raw DB error");
{
  const { UserModel } = makeFakeUserStore({}); // no records at all
  const saveHandler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  await saveHandler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1 }), res);

  check("HTTP 404", res.statusCode === 404);
  check("success is not present/true", res.body.success !== true);
}

// ---------------------------------------------------------------------------
console.log("\n[S8] Database/query failures are converted into a safe, generic 500 (never a raw DB error)");
{
  const SENSITIVE_MESSAGE = "MongoServerError: bad auth for user jobportaluser:S3cr3tP@ssw0rd@cluster0.xvtgoah.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));

  const UserModel = { findById: async () => { throw new Error(SENSITIVE_MESSAGE); } };
  const handler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { jobId: VALID_JOB_ID_1 }), res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error is never echoed to the client", !JSON.stringify(res.body).includes(SENSITIVE_MESSAGE));
  check("a generic error message is returned instead", typeof res.body.error === "string" && res.body.error.length > 0 && !res.body.error.includes("Mongo"));
  check("the real error was still logged server-side for debugging", logged.some((m) => m.includes(SENSITIVE_MESSAGE)));
}

// ---------------------------------------------------------------------------
console.log("\n[S9] Unauthenticated requests cannot reach save-job/is-saved handlers (route wiring)");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/user.js"), "utf8");

  check("POST /savejob is wired through authMiddleware", /router\.post\(\s*["']\/savejob["']\s*,\s*authMiddleware\s*,\s*saveJob\s*\)/.test(routeSource));
  check("POST /issaved is wired through authMiddleware", /router\.post\(\s*["']\/issaved["']\s*,\s*authMiddleware\s*,\s*isJobSaved\s*\)/.test(routeSource));
  check("authMiddleware still imported from middleware/auth.js", /import authMiddleware from ["']\.\.\/middleware\/auth\.js["']/.test(routeSource));
}

// ---------------------------------------------------------------------------
console.log("\n[S10] No secrets, tokens, or Authorization headers ever appear in save-job responses");
{
  const { UserModel } = makeFakeUserStore({ [SELF_ID]: { _id: SELF_ID, savedJobs: [] } });
  const handler = createSaveJobHandler({ User: UserModel });
  const res = fakeRes();
  const req = authedReq(SELF_ID, { jobId: VALID_JOB_ID_1 });
  req.headers = { authorization: "Bearer some.fake.jwt.token.value" };
  await handler(req, res);

  check("the Authorization header value never appears in the response body", !JSON.stringify(res.body).includes("some.fake.jwt.token.value"));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
