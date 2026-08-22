// Deterministic verification for the Phase 1I-5 audit fixes to
// POST /api/jobs, PUT /api/jobs/:id, and DELETE /api/jobs/:id:
//   - MongoDB update-operator injection prevention (a client could
//     previously smuggle raw Mongo operators like $unset/$rename through
//     PUT /api/jobs/:id's request body, since it was forwarded directly
//     as the update document)
//   - mass-assignment prevention on job creation/update (internal/
//     lifecycle fields — status, dedup_fingerprint, source, source_id,
//     expires_at, hiring_stage, last_seen_at — are no longer directly
//     client-settable)
//   - response shape consistency with GET /api/jobs / GET /api/jobs/:id
//     (the same {success, data} envelope and public field whitelist,
//     instead of the raw Mongoose document)
//   - id validation, and safe try/catch error handling (previously these
//     three handlers had none at all)
//
// No MongoDB connection is opened and no live HTTP server is started —
// controllers/jobs.js's `deps` injection seam (the same pattern already
// used for listJobs/getJob) supplies mocked jobService behavior, and
// jobService.pickManualJobFields (a pure function) is exercised directly
// to prove the field-whitelisting/injection-prevention claim precisely.
//
// Run via: node backend/scripts/testJobMutationSecurity.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCreateJobHandler, createUpdateJobHandler, createRemoveJobHandler } from "../controllers/jobs.js";
import { pickManualJobFields, toPublicJob } from "../services/jobService.js";

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
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send() {
      this.ended = true;
      return this;
    },
  };
}

const VALID_ID = "60f7c2b5c1234567890000aa";

console.log("============================");
console.log(" JOB CREATE/UPDATE/DELETE SECURITY — DETERMINISTIC TESTS");
console.log(" (no MongoDB connection, no HTTP server, no live API calls)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[M1] pickManualJobFields keeps only genuine, safe job content fields");
{
  const input = {
    title: "Backend Developer",
    company: "Acme",
    description: "A real job",
    location: { raw: "Remote" },
    salary: { min: 100, max: 200 },
    job_type: "full_time",
    is_remote: true,
    experience_level: "mid",
    is_tech_relevant: true,
    tech_relevance_source: "manual",
    source_category: "IT",
    logo: "https://example.com/logo.png",
    date_posted: "2026-01-01T00:00:00Z",
  };
  const picked = pickManualJobFields(input);
  check("every legitimate content field survives", Object.keys(picked).sort().join(",") === Object.keys(input).sort().join(","));
  check("field values are passed through unmodified", picked.title === "Backend Developer" && picked.company === "Acme");
}

// ---------------------------------------------------------------------------
console.log("\n[M2] pickManualJobFields strips internal/lifecycle fields (mass-assignment prevention)");
{
  const maliciousInput = {
    title: "Real Job",
    company: "Acme",
    description: "desc",
    // Fields a client should NEVER be able to set directly:
    status: "expired",
    dedup_fingerprint: "fake-fingerprint-to-collide-with-a-real-job",
    source: "adzuna",
    source_id: "9999999",
    expires_at: "2099-01-01T00:00:00Z",
    hiring_stage: "final",
    last_seen_at: "2020-01-01T00:00:00Z",
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
    __v: 999,
  };
  const picked = pickManualJobFields(maliciousInput);

  for (const forbiddenField of ["status", "dedup_fingerprint", "source", "source_id", "expires_at", "hiring_stage", "last_seen_at", "_id", "createdAt", "updatedAt", "__v"]) {
    check(`"${forbiddenField}" is stripped, never reaches a Mongo write`, !(forbiddenField in picked));
  }
  check("the legitimate fields in the same payload still survive", picked.title === "Real Job" && picked.company === "Acme" && picked.description === "desc");
}

// ---------------------------------------------------------------------------
console.log("\n[M3] pickManualJobFields strips raw MongoDB update operators (injection prevention)");
{
  // This is the exact shape of a MongoDB update-operator-injection
  // attempt: previously, PUT /api/jobs/:id forwarded req.body directly
  // as Job.findByIdAndUpdate's update document, so a body shaped like
  // this would have been interpreted by MongoDB as real operators, not
  // literal field values.
  const injectionAttempt = {
    title: "Legit-looking title",
    $unset: { status: "" },
    $rename: { title: "hacked_field" },
    $inc: { salary: { max: 999999999 } },
    $currentDate: { expires_at: true },
    "$where": "sleep(10000)",
  };
  const picked = pickManualJobFields(injectionAttempt);

  for (const operatorKey of ["$unset", "$rename", "$inc", "$currentDate", "$where"]) {
    check(`operator key "${operatorKey}" never survives into the picked field set`, !(operatorKey in picked));
  }
  check("no key in the picked result starts with '$' (defense in depth, not just the specific keys tested above)", Object.keys(picked).every((k) => !k.startsWith("$")));
  check("the one legitimate field in the same payload still survives", picked.title === "Legit-looking title");
}

// ---------------------------------------------------------------------------
console.log("\n[M4] toPublicJob exposes only the public whitelist, never internal fields");
{
  const rawDocLikeObject = {
    _id: VALID_ID,
    title: "T",
    company: "C",
    description: "D",
    apply_link: "https://example.com",
    location: { raw: "Remote" },
    salary: { min: null, max: null, currency: null, is_estimated: null },
    job_type: "unknown",
    is_remote: null,
    experience_level: "unknown",
    is_tech_relevant: null,
    tech_relevance_source: "manual",
    source_category: null,
    tags: [],
    normalized_skills: [],
    logo: "",
    date_posted: new Date(),
    status: "active",
    source: "manual",
    source_id: undefined,
    // Internal fields that must NEVER appear in the public shape:
    dedup_fingerprint: "abc123",
    hiring_stage: "final",
    last_seen_at: new Date(),
    expires_at: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };
  const pub = toPublicJob(rawDocLikeObject);

  for (const forbiddenField of ["dedup_fingerprint", "hiring_stage", "last_seen_at", "expires_at", "createdAt", "updatedAt", "__v"]) {
    check(`public job shape never includes "${forbiddenField}"`, !(forbiddenField in pub));
  }
  check("public job shape includes _id and the real content fields", pub._id === VALID_ID && pub.title === "T" && pub.company === "C");
}

// ---------------------------------------------------------------------------
console.log("\n[M5] createJob: success returns 201 with the {success, data} envelope");
{
  let receivedBody = null;
  const fixtureDoc = { toObject: () => ({ _id: VALID_ID, title: "New Job", company: "Acme" }) };
  const handler = createCreateJobHandler({
    createManualJob: async (body) => {
      receivedBody = body;
      return fixtureDoc;
    },
    toPublicJob: (doc) => ({ _id: VALID_ID, title: doc.toObject().title }),
  });
  const res = fakeRes();
  await handler({ body: { title: "New Job", company: "Acme", description: "desc" } }, res);

  check("HTTP 201", res.statusCode === 201);
  check("success: true", res.body.success === true);
  check("data is present and shaped via toPublicJob", res.body.data.title === "New Job");
  check("the raw request body was passed through to the service layer (whitelisting happens there)", receivedBody.title === "New Job");
}

// ---------------------------------------------------------------------------
console.log("\n[M6] createJob: a schema validation failure returns a clean 400, not a raw 500/stack trace");
{
  const validationErr = new Error("Job validation failed");
  validationErr.name = "ValidationError";
  validationErr.errors = { title: { message: "Path `title` is required." }, company: { message: "Path `company` is required." } };

  const handler = createCreateJobHandler({ createManualJob: async () => { throw validationErr; } });
  const res = fakeRes();
  await handler({ body: {} }, res);

  check("HTTP 400 (a client input problem, not a server failure)", res.statusCode === 400);
  check("success: false", res.body.success === false);
  check("per-field validation messages are surfaced", Array.isArray(res.body.details) && res.body.details.includes("Path `title` is required."));
  check("no raw Mongoose error object/stack is present in the response", !("stack" in res.body) && !("errors" in res.body));
}

// ---------------------------------------------------------------------------
console.log("\n[M7] createJob: an unexpected database failure returns a safe generic 500");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));

  const handler = createCreateJobHandler({ createManualJob: async () => { throw new Error(SENSITIVE); } });
  const res = fakeRes();
  await handler({ body: { title: "X" } }, res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error never appears in the response", !JSON.stringify(res.body).includes(SENSITIVE));
  check("the real error was still logged server-side", logged.some((m) => m.includes(SENSITIVE)));
}

// ---------------------------------------------------------------------------
console.log("\n[M8] updateJob: a malformed id is rejected with 400 before the service is ever called");
{
  let called = false;
  const handler = createUpdateJobHandler({ updateJobById: async () => { called = true; } });
  const res = fakeRes();
  await handler({ params: { id: "not-a-valid-id" }, body: { title: "X" } }, res);

  check("HTTP 400", res.statusCode === 400);
  check("success: false", res.body.success === false);
  check("the service layer was never called for a malformed id", called === false);
}

// ---------------------------------------------------------------------------
console.log("\n[M9] updateJob: success returns 200 with the {success, data} envelope");
{
  let receivedArgs = null;
  const handler = createUpdateJobHandler({
    updateJobById: async (id, data) => {
      receivedArgs = { id, data };
      return { toObject: () => ({ _id: id, title: data.title }) };
    },
    toPublicJob: (doc) => doc.toObject(),
  });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID }, body: { title: "Updated Title" } }, res);

  check("HTTP 200", res.statusCode === 200);
  check("success: true", res.body.success === true);
  check("data reflects the update", res.body.data.title === "Updated Title");
  check("the correct id was forwarded to the service layer", receivedArgs.id === VALID_ID);
}

// ---------------------------------------------------------------------------
console.log("\n[M10] updateJob: a nonexistent job returns 404");
{
  const handler = createUpdateJobHandler({ updateJobById: async () => null });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID }, body: { title: "X" } }, res);

  check("HTTP 404", res.statusCode === 404);
  check("success: false", res.body.success === false);
}

// ---------------------------------------------------------------------------
console.log("\n[M11] updateJob: a schema validation failure returns a clean 400");
{
  const validationErr = new Error("Job validation failed");
  validationErr.name = "ValidationError";
  validationErr.errors = { experience_level: { message: "`bogus` is not a valid enum value for path `experience_level`." } };

  const handler = createUpdateJobHandler({ updateJobById: async () => { throw validationErr; } });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID }, body: { experience_level: "bogus" } }, res);

  check("HTTP 400", res.statusCode === 400);
  check("the enum validation message is surfaced", res.body.details.some((m) => m.includes("experience_level")));
}

// ---------------------------------------------------------------------------
console.log("\n[M12] updateJob: an unexpected database failure returns a safe generic 500");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));

  const handler = createUpdateJobHandler({ updateJobById: async () => { throw new Error(SENSITIVE); } });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID }, body: { title: "X" } }, res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error never appears in the response", !JSON.stringify(res.body).includes(SENSITIVE));
  check("the real error was still logged server-side", logged.some((m) => m.includes(SENSITIVE)));
}

// ---------------------------------------------------------------------------
console.log("\n[M13] removeJob: a malformed id is rejected with 400 before the service is ever called");
{
  let called = false;
  const handler = createRemoveJobHandler({ deleteJobById: async () => { called = true; } });
  const res = fakeRes();
  await handler({ params: { id: "abc" } }, res);

  check("HTTP 400", res.statusCode === 400);
  check("the service layer was never called for a malformed id", called === false);
}

// ---------------------------------------------------------------------------
console.log("\n[M14] removeJob: success returns 204 with no body, for a valid id");
{
  let receivedId = null;
  const handler = createRemoveJobHandler({ deleteJobById: async (id) => { receivedId = id; } });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID } }, res);

  check("HTTP 204", res.statusCode === 204);
  check("response ended with no JSON body", res.ended === true && res.body === undefined);
  check("the correct id was forwarded", receivedId === VALID_ID);
}

// ---------------------------------------------------------------------------
console.log("\n[M15] removeJob: an unexpected database failure returns a safe generic 500");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));

  const handler = createRemoveJobHandler({ deleteJobById: async () => { throw new Error(SENSITIVE); } });
  const res = fakeRes();
  await handler({ params: { id: VALID_ID } }, res);

  console.error = originalError;

  check("HTTP 500", res.statusCode === 500);
  check("the raw error never appears in the response", !JSON.stringify(res.body).includes(SENSITIVE));
  check("the real error was still logged server-side", logged.some((m) => m.includes(SENSITIVE)));
}

// ---------------------------------------------------------------------------
console.log("\n[M16] jobService.updateJobById always wraps the whitelisted update in $set (static check)");
{
  const serviceSource = fs.readFileSync(path.resolve(__dirname, "../services/jobService.js"), "utf8");
  check(
    "updateJobById passes { $set: <whitelisted> } to findByIdAndUpdate, never the raw body",
    /Job\.findByIdAndUpdate\(id,\s*\{\s*\$set:\s*update\s*\},\s*\{\s*new:\s*true,\s*runValidators:\s*true\s*\}\)/.test(serviceSource)
  );
  check("createManualJob no longer spreads raw `data` directly into `new Job(...)`", !/new Job\(\{\s*\.\.\.data,/.test(serviceSource));
}

// ---------------------------------------------------------------------------
console.log("\n[M17] Route wiring: create/update/delete remain behind authMiddleware (regression)");
{
  const routeSource = fs.readFileSync(path.resolve(__dirname, "../routes/job.js"), "utf8");
  check("POST / requires authMiddleware", /router\.post\(\s*["']\/["']\s*,\s*authMiddleware\s*,\s*createJob\s*\)/.test(routeSource));
  check("PUT /:id requires authMiddleware", /router\.put\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*updateJob\s*\)/.test(routeSource));
  check("DELETE /:id requires authMiddleware", /router\.delete\(\s*["']\/:id["']\s*,\s*authMiddleware\s*,\s*removeJob\s*\)/.test(routeSource));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
