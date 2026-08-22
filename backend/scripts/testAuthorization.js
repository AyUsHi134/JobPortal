// Deterministic verification for the Phase 1I-4 profile-authorization
// and job-CRUD-authorization fixes. No MongoDB connection is opened and
// no live HTTP server is started — controllers/user.js's `deps`
// injection seam supplies mocked User model behavior, and route wiring
// (job create/update/delete now requiring authMiddleware, GET routes
// staying public) is verified statically against the actual route
// files, the same technique used throughout Phase 1I-1..1I-3's own
// regression suites.
//
// Run via: node backend/scripts/testAuthorization.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGetProfileHandler, createUpdateProfileHandler } from "../controllers/user.js";

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

function authedReq(userId, body = {}) {
  return { user: { id: userId }, body };
}

const SELF_ID = "6a0000000000000000000001";
const OTHER_USER_ID = "6a0000000000000000000002";

// A minimal fake Mongoose document: supports .save() and .toObject(),
// and is itself "thenable" so `await UserModel.findById(id)` (used by
// updateProfile, no .select()) resolves directly to it, while
// `UserModel.findById(id).select(...)` (used by getProfile) also works.
function makeFakeDoc(fields, { onSave } = {}) {
  const doc = {
    ...fields,
    save: async function () {
      if (onSave) onSave(this);
      return this;
    },
    toObject: function () {
      const { save, toObject, then, catch: _catch, select, ...plain } = this;
      return plain;
    },
  };
  return doc;
}

function makeFakeUserModel({ record = null, selectResult, throwErr } = {}) {
  const findByIdCalls = [];
  const UserModel = {
    findById: (id) => {
      findByIdCalls.push(id);
      if (throwErr) {
        const rejected = Promise.reject(throwErr);
        return { select: () => rejected, then: (res, rej) => rejected.then(res, rej), catch: (rej) => rejected.catch(rej) };
      }
      const doc = record ? makeFakeDoc(record) : null;
      return {
        select: async () => (doc ? (selectResult !== undefined ? selectResult : { ...record }) : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
        catch: (reject) => Promise.resolve(doc).catch(reject),
      };
    },
  };
  return { UserModel, findByIdCalls };
}

console.log("============================");
console.log(" PROFILE & JOB-CRUD AUTHORIZATION — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[P1] getProfile returns the authenticated caller's own profile, without the password");
{
  const record = { _id: SELF_ID, name: "Asha", email: "asha@example.com", password: "hashed:x", savedJobs: [] };
  const { UserModel, findByIdCalls } = makeFakeUserModel({ record, selectResult: { _id: SELF_ID, name: "Asha", email: "asha@example.com", savedJobs: [] } });
  const handler = createGetProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID), res);

  check("HTTP 200", res.statusCode === 200);
  check("only the authenticated caller's own id was looked up", findByIdCalls.length === 1 && findByIdCalls[0] === SELF_ID);
  check("password is never present in the response", !("password" in res.body));
}

// ---------------------------------------------------------------------------
console.log("\n[P2] getProfile handles a vanished user safely (404, not a crash)");
{
  const { UserModel } = makeFakeUserModel({ record: null });
  const handler = createGetProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID), res);

  check("HTTP 404, not an unhandled exception", res.statusCode === 404);
}

// ---------------------------------------------------------------------------
console.log("\n[P3] getProfile converts a database failure into a safe 500 (no raw error leak)");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));

  const { UserModel } = makeFakeUserModel({ throwErr: new Error(SENSITIVE) });
  const handler = createGetProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID), res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error never appears in the response", !JSON.stringify(res.body).includes(SENSITIVE));
  check("the real error was still logged server-side", logged.some((m) => m.includes(SENSITIVE)));
}

// ---------------------------------------------------------------------------
console.log("\n[P4] A user CANNOT modify another user's profile — updateProfile only ever targets the authenticated caller");
{
  let savedOnto = null;
  const record = { _id: SELF_ID, name: "Old Name", email: "old@example.com", password: "hashed:x", savedJobs: [] };
  const { UserModel, findByIdCalls } = makeFakeUserModel({});
  // Override findById to track exactly which id's document gets mutated.
  UserModel.findById = (id) => {
    findByIdCalls.push(id);
    const doc = makeFakeDoc({ ...record }, { onSave: (d) => { savedOnto = { id, name: d.name, email: d.email }; } });
    return { then: (resolve) => Promise.resolve(doc).then(resolve), catch: () => {} };
  };

  const handler = createUpdateProfileHandler({ User: UserModel });
  const res = fakeRes();
  // The request body has no id field at all to manipulate — updateProfile
  // never reads one — but even a client attempting to smuggle one in via
  // an unexpected field must not influence which document is targeted.
  await handler(authedReq(SELF_ID, { name: "New Name", user_id: OTHER_USER_ID, userId: OTHER_USER_ID }), res);

  check("only the authenticated caller's own id was ever looked up or mutated", findByIdCalls.length === 1 && findByIdCalls[0] === SELF_ID);
  check("the update was applied to the caller's own document, not OTHER_USER_ID", savedOnto.id === SELF_ID);
  check("the name change took effect on the right document", savedOnto.name === "New Name");
}

// ---------------------------------------------------------------------------
console.log("\n[P5] updateProfile never returns the password hash (the historical leak)");
{
  const record = { _id: SELF_ID, name: "Asha", email: "asha@example.com", password: "hashed:supersecret", savedJobs: [] };
  const UserModel = { findById: (id) => Promise.resolve(makeFakeDoc({ ...record })) };
  const handler = createUpdateProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { name: "Asha B." }), res);

  check("HTTP 200", res.statusCode === 200);
  check("password is completely absent from the response body", !("password" in res.body));
  check("the hash value never appears anywhere in the serialized response", !JSON.stringify(res.body).includes("hashed:supersecret"));
  check("the actual field update still took effect (functionality preserved)", res.body.name === "Asha B.");
}

// ---------------------------------------------------------------------------
console.log("\n[P6] updateProfile handles a vanished user safely (the null-check fix — previously an uncaught crash)");
{
  const UserModel = { findById: (id) => Promise.resolve(null) };
  const handler = createUpdateProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { name: "New Name" }), res);

  check("HTTP 404, not an unhandled TypeError from `user.name = ...` on null", res.statusCode === 404);
  check("success is not present/true", res.body.success !== true);
}

// ---------------------------------------------------------------------------
console.log("\n[P7] updateProfile reports a duplicate email cleanly, not as a raw Mongo driver error");
{
  const dupErr = new Error("E11000 duplicate key error collection: jobportal.users index: email_1 dup key: { email: \"taken@example.com\" }");
  dupErr.code = 11000;
  const record = { _id: SELF_ID, name: "Asha", email: "asha@example.com", password: "hashed:x", savedJobs: [] };
  const UserModel = {
    findById: (id) =>
      Promise.resolve(
        makeFakeDoc({ ...record }, {
          onSave: () => {
            throw dupErr;
          },
        })
      ),
  };
  const handler = createUpdateProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { email: "taken@example.com" }), res);

  check("HTTP 400 (a client input problem, not a server failure)", res.statusCode === 400);
  check("the raw Mongo driver error text never appears in the response", !JSON.stringify(res.body).includes("E11000"));
}

// ---------------------------------------------------------------------------
console.log("\n[P8] updateProfile converts an unexpected database failure into a safe 500");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));

  const UserModel = { findById: (id) => Promise.reject(new Error(SENSITIVE)) };
  const handler = createUpdateProfileHandler({ User: UserModel });
  const res = fakeRes();
  await handler(authedReq(SELF_ID, { name: "X" }), res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error never appears in the response", !JSON.stringify(res.body).includes(SENSITIVE));
  check("the real error was still logged server-side", logged.some((m) => m.includes(SENSITIVE)));
}

// ---------------------------------------------------------------------------
console.log("\n[P9] Job create/update/delete now require authentication (previously fully open)");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/job.js"), "utf8");

  check("authMiddleware is imported in routes/job.js", /import authMiddleware from ["']\.\.\/middleware\/auth\.js["']/.test(routeSource));
  check("POST / (create) is wired through authMiddleware", /router\.post\(\s*["']\/["']\s*,\s*authMiddleware\s*,\s*createJob\s*\)/.test(routeSource));
  check("PUT /:id (update) is wired through authMiddleware", /router\.put\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*updateJob\s*\)/.test(routeSource));
  check("DELETE /:id (remove) is wired through authMiddleware", /router\.delete\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*removeJob\s*\)/.test(routeSource));
}

// ---------------------------------------------------------------------------
console.log("\n[P10] Job listing/detail (read) routes remain public and untouched — regression");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/job.js"), "utf8");

  check("GET / (listing) has no authMiddleware — still public", /router\.get\(\s*["']\/["']\s*,\s*listJobs\s*\)/.test(routeSource));
  check("GET /:id (detail) has no authMiddleware — still public", /router\.get\(\s*["']\/:id["']\s*,\s*getJob\s*\)/.test(routeSource));
}

// ---------------------------------------------------------------------------
console.log("\n[P11] Profile routes remain behind authMiddleware — regression (unchanged from before this phase)");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/user.js"), "utf8");

  check("GET /profile still requires authMiddleware", /router\.get\(\s*["']\/profile["']\s*,\s*authMiddleware\s*,\s*getProfile\s*\)/.test(routeSource));
  check("PUT /profile still requires authMiddleware", /router\.put\(\s*["']\/profile["']\s*,\s*authMiddleware\s*,\s*updateProfile\s*\)/.test(routeSource));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
