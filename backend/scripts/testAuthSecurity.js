// Deterministic verification for the Phase 1I-4 authentication security
// fixes: signup, login, password hashing/never-returned, and JWT
// verification middleware (missing/malformed/invalid/expired tokens,
// and that the authenticated identity comes from the verified token).
// No MongoDB connection is opened and no live HTTP server is started —
// controllers/auth.js's `deps` injection seam (the same established
// pattern used throughout controllers/jobs.js since Phase 1I-1) supplies
// a mocked User model/bcrypt/jwt.sign, and middleware/auth.js is
// exercised directly as a plain function against real jsonwebtoken
// tokens signed with a fake, test-only secret (never the real .env
// value — this process never reads or touches the real JWT_SECRET).
//
// Run via: node backend/scripts/testAuthSecurity.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

import { createRegisterHandler, createLoginHandler } from "../controllers/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A fake, test-only secret — never the real value from .env. This is the
// only JWT_SECRET this process ever sees.
process.env.JWT_SECRET = "test-only-fake-secret-do-not-use-in-real-env";

// middleware/auth.js reads process.env.JWT_SECRET at call time, so it's
// safe to import after setting the fake secret above.
const { default: authMiddleware } = await import("../middleware/auth.js");

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

// Minimal fake Mongoose User model: supports `findOne` (used by
// register/login) and `new UserModel(data)` with a `.save()` (used by
// register). No real Mongoose/MongoDB involved.
function makeFakeUserModel({ existingUser = null, saveImpl } = {}) {
  const savedInstances = [];
  function FakeUserModel(data) {
    this._id = "6a0000000000000000000099";
    Object.assign(this, data);
    this.save = saveImpl || (async function () { savedInstances.push(this); return this; });
  }
  FakeUserModel.findOne = async () => existingUser;
  FakeUserModel.__savedInstances = savedInstances;
  return FakeUserModel;
}

console.log("============================");
console.log(" AUTHENTICATION SECURITY — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls, fake JWT secret)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[A1] Signup succeeds with valid input");
{
  const UserModel = makeFakeUserModel({ existingUser: null });
  let hashCalledWith = null;
  const handler = createRegisterHandler({
    User: UserModel,
    hash: async (pw, rounds) => {
      hashCalledWith = { pw, rounds };
      return `hashed:${pw}`;
    },
  });
  const res = fakeRes();
  await handler({ body: { name: "Asha", email: "asha@example.com", password: "correct horse battery staple" } }, res);

  check("HTTP 201 on successful signup", res.statusCode === 201);
  check("response body confirms creation, no user object echoed", res.body.msg === "User created" && res.body.user === undefined);
  check("a real hash call was made with the plaintext password and a real bcrypt cost factor", hashCalledWith.pw === "correct horse battery staple" && hashCalledWith.rounds === 10);
}

// ---------------------------------------------------------------------------
console.log("\n[A2] Password is stored only as a hash and is never returned");
{
  const UserModel = makeFakeUserModel({ existingUser: null });
  const handler = createRegisterHandler({ User: UserModel, hash: async (pw) => `hashed:${pw}` });
  const res = fakeRes();
  await handler({ body: { name: "Bo", email: "bo@example.com", password: "s3cret-plaintext" } }, res);

  const saved = UserModel.__savedInstances[0];
  check("the persisted user's password field is the hash, not the plaintext", saved.password === "hashed:s3cret-plaintext");
  check("the plaintext password never appears anywhere in the HTTP response", !JSON.stringify(res.body).includes("s3cret-plaintext"));
  check("the hash itself never appears anywhere in the HTTP response either", !JSON.stringify(res.body).includes("hashed:s3cret-plaintext"));
}

// ---------------------------------------------------------------------------
console.log("\n[A3] Signup rejects a duplicate email (existing behavior preserved)");
{
  const UserModel = makeFakeUserModel({ existingUser: { _id: "x", email: "taken@example.com" } });
  const handler = createRegisterHandler({ User: UserModel, hash: async () => "irrelevant" });
  const res = fakeRes();
  await handler({ body: { name: "C", email: "taken@example.com", password: "whatever" } }, res);

  check("HTTP 400 on duplicate email", res.statusCode === 400);
  check("no password/hash present in the rejection response", !JSON.stringify(res.body).toLowerCase().includes("password"));
}

// ---------------------------------------------------------------------------
console.log("\n[A4] Login succeeds with correct credentials and issues a JWT");
{
  const fixtureUser = { _id: "6a0000000000000000000042", name: "Dee", email: "dee@example.com", password: "hashed:realpassword" };
  const UserModel = makeFakeUserModel({ existingUser: fixtureUser });
  let signCalledWith = null;
  const handler = createLoginHandler({
    User: UserModel,
    compare: async (plain, hash) => plain === "realpassword" && hash === "hashed:realpassword",
    sign: (payload, secret, options) => {
      signCalledWith = { payload, secret, options };
      return "fake.jwt.token";
    },
  });
  const res = fakeRes();
  await handler({ body: { email: "dee@example.com", password: "realpassword" } }, res);

  check("HTTP 200 on successful login", res.statusCode === 200);
  check("a token is returned", res.body.token === "fake.jwt.token");
  check("the returned user object exposes only name/email, no password/id/hash", Object.keys(res.body.user).sort().join(",") === "email,name" && res.body.user.name === "Dee" && res.body.user.email === "dee@example.com");
  check("the JWT payload identifies the user by id (not by client-suppliable data)", signCalledWith.payload.id === fixtureUser._id);
  check("the existing JWT configuration (2-day expiry) was used, unchanged", signCalledWith.options.expiresIn === "2d");
}

// ---------------------------------------------------------------------------
console.log("\n[A5] Login fails safely with an incorrect password");
{
  const fixtureUser = { _id: "x", name: "Dee", email: "dee@example.com", password: "hashed:realpassword" };
  const UserModel = makeFakeUserModel({ existingUser: fixtureUser });
  const handler = createLoginHandler({ User: UserModel, compare: async () => false, sign: () => "should-not-be-called" });
  const res = fakeRes();
  await handler({ body: { email: "dee@example.com", password: "wrong-password" } }, res);

  check("HTTP 401 (an authentication failure, not a generic 400)", res.statusCode === 401);
  check("the response body never includes the real password or its hash", !JSON.stringify(res.body).includes("realpassword"));
  check("a generic, non-account-specific error message is used", res.body.msg === "Invalid credentials");
}

// ---------------------------------------------------------------------------
console.log("\n[A6] Login fails safely for a nonexistent account, indistinguishably from a wrong password");
{
  const UserModel = makeFakeUserModel({ existingUser: null });
  const handler = createLoginHandler({ User: UserModel, compare: async () => { throw new Error("compare should never be called for a nonexistent user"); }, sign: () => "should-not-be-called" });
  const res = fakeRes();
  await handler({ body: { email: "nobody@example.com", password: "anything" } }, res);

  check("HTTP 401", res.statusCode === 401);
  check("the exact same generic message as a wrong-password failure (no user-enumeration signal)", res.body.msg === "Invalid credentials");
}

// ---------------------------------------------------------------------------
console.log("\n[A7] JWT verification middleware rejects a request with no Authorization header");
{
  let nextCalled = false;
  const res = fakeRes();
  authMiddleware({ header: () => undefined }, res, () => { nextCalled = true; });

  check("HTTP 401", res.statusCode === 401);
  check("next() was never called", nextCalled === false);
}

// ---------------------------------------------------------------------------
console.log("\n[A8] JWT verification middleware rejects a malformed Authorization header");
{
  for (const badHeader of ["not-a-bearer-token", "Bearer", "Bearer "]) {
    let nextCalled = false;
    const res = fakeRes();
    authMiddleware({ header: () => badHeader }, res, () => { nextCalled = true; });
    check(`"${badHeader}" → HTTP 401, next() never called`, res.statusCode === 401 && nextCalled === false);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[A9] JWT verification middleware rejects an invalid/forged token");
{
  const forgedToken = jwt.sign({ id: "attacker-controlled-id" }, "a-completely-different-secret", { expiresIn: "2d" });
  let nextCalled = false;
  const res = fakeRes();
  authMiddleware({ header: () => `Bearer ${forgedToken}` }, res, () => { nextCalled = true; });

  check("HTTP 401 for a token signed with the wrong secret", res.statusCode === 401);
  check("next() was never called — the forged identity never reaches a handler", nextCalled === false);
}

// ---------------------------------------------------------------------------
console.log("\n[A10] JWT verification middleware rejects a syntactically-invalid token string");
{
  let nextCalled = false;
  const res = fakeRes();
  authMiddleware({ header: () => "Bearer this.is.not.a.real.jwt" }, res, () => { nextCalled = true; });

  check("HTTP 401", res.statusCode === 401);
  check("next() was never called", nextCalled === false);
}

// ---------------------------------------------------------------------------
console.log("\n[A11] JWT verification middleware rejects an expired token");
{
  // A negative expiresIn produces a token whose `exp` is already in the
  // past at the moment it's signed — no need to sleep in a deterministic
  // test to prove expiry is enforced.
  const expiredToken = jwt.sign({ id: "6a0000000000000000000042" }, process.env.JWT_SECRET, { expiresIn: "-10s" });
  let nextCalled = false;
  const res = fakeRes();
  authMiddleware({ header: () => `Bearer ${expiredToken}` }, res, () => { nextCalled = true; });

  check("HTTP 401 for an expired token", res.statusCode === 401);
  check("next() was never called", nextCalled === false);
}

// ---------------------------------------------------------------------------
console.log("\n[A12] A valid token establishes req.user from the VERIFIED token, not from client input");
{
  const realToken = jwt.sign({ id: "6a0000000000000000000042" }, process.env.JWT_SECRET, { expiresIn: "2d" });
  let nextCalled = false;
  const req = { header: () => `Bearer ${realToken}`, body: { userId: "someone-elses-id-the-client-tried-to-supply" } };
  const res = fakeRes();
  authMiddleware(req, res, () => { nextCalled = true; });

  check("next() was called (valid token accepted)", nextCalled === true);
  check("req.user is an object with an `id` field (not a bare string — the historical bug)", typeof req.user === "object" && req.user !== null && "id" in req.user);
  check("req.user.id comes from the verified token's subject, matching what was signed", req.user.id === "6a0000000000000000000042");
  check("req.user.id is NOT the client-supplied req.body.userId — token identity always wins", req.user.id !== req.body.userId);
}

// ---------------------------------------------------------------------------
console.log("\n[A13] The JWT itself, and any secret, is never logged by the middleware");
{
  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];
  console.log = (...args) => captured.push(args.join(" "));
  console.error = (...args) => captured.push(args.join(" "));

  const realToken = jwt.sign({ id: "6a0000000000000000000042" }, process.env.JWT_SECRET, { expiresIn: "2d" });
  const forgedToken = jwt.sign({ id: "x" }, "wrong-secret", { expiresIn: "2d" });

  authMiddleware({ header: () => `Bearer ${realToken}` }, fakeRes(), () => {});
  authMiddleware({ header: () => `Bearer ${forgedToken}` }, fakeRes(), () => {});
  authMiddleware({ header: () => undefined }, fakeRes(), () => {});

  console.log = originalLog;
  console.error = originalError;

  check("nothing was logged by the middleware on success, failure, or missing-header paths", captured.length === 0);
  check("the fake JWT_SECRET never appears in any captured output (defense in depth)", !captured.some((line) => line.includes(process.env.JWT_SECRET)));
}

// ---------------------------------------------------------------------------
console.log("\n[A14] Existing signup/login route wiring and response contract are otherwise unchanged");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/auth.js"), "utf8");
  const controllerSource = fs.readFileSync(path.resolve(__dirname, "../controllers/auth.js"), "utf8");

  check("routes/auth.js still wires POST /signup → register, POST /login → login", /router\.post\(\s*["']\/signup["']\s*,\s*register\s*\)/.test(routeSource) && /router\.post\(\s*["']\/login["']\s*,\s*login\s*\)/.test(routeSource));
  check("register is still exported under the same name (routes/auth.js needed no change)", /export const register = createRegisterHandler\(\);/.test(controllerSource));
  check("login is still exported under the same name (routes/auth.js needed no change)", /export const login = createLoginHandler\(\);/.test(controllerSource));
  check("password hashing still uses bcrypt with a real cost factor (10), not a weakened scheme", /bcrypt\.hash\(password, 10\)|hash\(password, 10\)/.test(controllerSource));
  check("JWT signing still uses the existing 2-day expiry configuration, unchanged", /expiresIn:\s*["']2d["']/.test(controllerSource));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
