# JobPortal Backend API Contract

**As of Phase 1I-5.** This document describes the backend exactly as implemented and live-verified — not an idealized or planned API. Where the current implementation has a known inconsistency or limitation, it is stated explicitly rather than smoothed over, so the frontend can be built against reality.

Base URL is whatever the backend is actually running on (e.g. `http://localhost:5000` in local dev — the backend does not read a `FRONTEND_URL`/base-path env var, and the frontend does not currently read a `VITE_API_URL`-style env var either; both are hardcoded today). CORS is currently hardcoded in `backend/index.js` to allow only `http://localhost:5173` with `credentials: true` — this **must** change before any non-localhost deployment, but is correct for local frontend development against this backend.

**The frontend must never call Adzuna or RemoteOK directly.** All job data is ingested server-side (scheduled every 6 hours, see `PHASE_1H2_REPORT.md`) into MongoDB; the frontend only ever talks to this backend's own `/api/jobs*` endpoints, which read from MongoDB — never from a third-party API at request time.

---

## 1. Authentication Endpoints

### `POST /api/auth/signup`
- **Auth required:** No.
- **Body:** `{ "name": string, "email": string, "password": string }`
- **201** — `{ "msg": "User created" }`. Password is bcrypt-hashed (cost 10) before storage; never returned in any response.
- **400** — `{ "msg": "User already exists" }` if the email is already registered.
- **500** — `{ "msg": "Server error" }` on an unexpected failure.
- No input validation beyond MongoDB's schema-level `required` — an empty/weak password is accepted as-is. No password complexity rule exists today.

### `POST /api/auth/login`
- **Auth required:** No.
- **Body:** `{ "email": string, "password": string }`
- **200** — `{ "token": "<JWT>", "user": { "name": string, "email": string } }`. The JWT payload is `{ id: <userId> }`, expires in **2 days**, signed with `process.env.JWT_SECRET`.
- **401** — `{ "msg": "Invalid credentials" }` for both a nonexistent email and a wrong password (identical response either way — the endpoint never reveals which case occurred, to prevent account enumeration).
- **500** — `{ "msg": "Server error" }`.

### Using the token
Every protected endpoint below requires:
```
Authorization: Bearer <token>
```
- Missing header → **401** `{ "message": "No token, auth denied" }`.
- Malformed header, invalid signature, or **expired** token → **401** `{ "message": "Token is not valid" }` (all three cases return the identical response — the middleware never distinguishes them).
- The authenticated user's identity is derived **only** from the verified token (`req.user.id`) — it is never taken from any request body field, even if the client sends one.

**Response-shape note:** auth endpoints use `{msg: ...}` on both success and error. This is a *different* convention from the job endpoints (`{success, data/error}`, §3–5) and the user endpoints (`{error: ...}` with no `success` key, §6–7). This is a real, current inconsistency across the API surface — documented here so the frontend can handle each endpoint family correctly rather than assuming one universal envelope. See `PHASE_1I5_REPORT.md` §4 for why this was not unified in this phase.

---

## 2. Public Job Object Shape

Every job object returned by `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs`, and `PUT /api/jobs/:id` has **exactly** this shape (an explicit whitelist — internal/operational fields are never included):

```json
{
  "_id": "656f...",
  "title": "Backend Developer (Node.js)",
  "company": "Brightline Systems Pvt Ltd",
  "description": "Full job description text (HTML in some source records — see note below)",
  "apply_link": "https://...",
  "location": {
    "raw": "Pune, Maharashtra",
    "display_name": "Pune, Maharashtra",
    "city": "Pune",
    "state": "Maharashtra",
    "country": "India"
  },
  "salary": {
    "min": null,
    "max": null,
    "currency": null,
    "is_estimated": null
  },
  "job_type": "full_time",
  "is_remote": null,
  "experience_level": "unknown",
  "is_tech_relevant": true,
  "tech_relevance_source": "source_category",
  "source_category": "IT Jobs",
  "tags": [],
  "normalized_skills": [],
  "logo": "",
  "date_posted": "2026-08-10T09:15:00.000Z",
  "status": "active",
  "source": "adzuna",
  "source_id": "5900001234"
}
```

**Fields that may be `null`/empty and must be handled gracefully by the UI:**
- `location.display_name` / `.city` / `.state` / `.country` — RemoteOK never populates structured location beyond `raw`; these are `null` for every RemoteOK-sourced job.
- `salary.min` / `.max` / `.currency` / `.is_estimated` — rarely populated by either source. **As of the last live-verified dataset (Phase 1I-2), 0 of 113 active jobs had a non-null `salary.max`.** Do not design a UI that assumes salary is usually present.
- `is_remote` — tri-state: `true`, `false`, or `null` (unknown — no signal from the source). Never assume `null` means "not remote."
- `experience_level` — one of `fresher`, `entry`, `junior`, `mid`, `senior`, `unknown`. **As of the last live ingestion run (Phase 1H-4), 0 of 113 newly-ingested jobs classified as `fresher`** — this is an honest reflection of the current query strategy/source data, not a classifier defect. Do not build a UI that assumes fresher jobs are reliably present in the feed today.
- `is_tech_relevant` — `true`, `false`, or `null` (unclassified).
- `source_category`, `logo`, `tags`, `normalized_skills` — frequently empty (`""`/`[]`) depending on source; `tags` in particular is essentially always empty for Adzuna-sourced jobs.
- `description` — passed through from the source verbatim, including any HTML markup RemoteOK's API includes. **The frontend is responsible for sanitizing this before rendering** (e.g. do not use `dangerouslySetInnerHTML` without a sanitizer like DOMPurify) — the backend does not strip or escape HTML in this field.

**Fields deliberately excluded from every response** (internal-only, never sent to any client): `dedup_fingerprint`, `hiring_stage`, `last_seen_at`, `expires_at`, Mongoose's `createdAt`/`updatedAt`/`__v`.

**Lifecycle:** every endpoint above only ever returns jobs with `status: "active"`. Expired/filled/removed jobs, and **113 legacy pre-existing documents that have no `status` field at all** (from a pre-Phase-1C importer, before the current schema existed), are invisible through the entire public API — this is intentional, not a bug. See `PHASE_1I5_REPORT.md` §6 for why this is not a frontend blocker and does not need to be migrated before frontend work.

---

## 3. Job Listing — `GET /api/jobs`

- **Auth required:** No.
- **Query parameters (all optional):**

| Parameter | Type | Behavior |
|---|---|---|
| `q` | string, ≤200 chars | Case-insensitive substring match across `title`, `company`, `description`, `normalized_skills` |
| `experience_level` | enum | One of `fresher`, `entry`, `junior`, `mid`, `senior`, `unknown` |
| `is_tech_relevant` | `"true"` \| `"false"` | Exact match; omit to include all (including unclassified) |
| `is_remote` | `"true"` \| `"false"` | Exact match; omit to include all (including unknown) |
| `country` / `state` / `city` | string | Case-insensitive **exact** match against structured location |
| `location` | string | Case-insensitive **partial** match against the raw/display location string |
| `source` | string | Exact match, e.g. `adzuna`, `remoteok`, `manual`. No enum validation — an unrecognized value just returns 0 results, not a 400 |
| `sort` | `"newest"` (default) \| `"oldest"` \| `"salary_high"` | |
| `page` | positive integer, default `1` | |
| `limit` | positive integer, default `20`, **clamped to a max of 100** | |

- **200** —
```json
{
  "success": true,
  "data": [ /* array of Job objects, see §2 */ ],
  "pagination": { "page": 1, "limit": 20, "total": 113, "totalPages": 6 }
}
```
A page beyond the last page returns `200` with an empty `data` array, not an error.
- **400** — invalid/unrecognized parameter value:
```json
{ "success": false, "error": "Invalid query parameters.", "details": ["experience_level must be one of: fresher, entry, junior, mid, senior, unknown."] }
```
- **500** — `{ "success": false, "error": "Failed to retrieve jobs. Please try again later." }` (a real DB failure; never includes the underlying error).

---

## 4. Job Detail — `GET /api/jobs/:id`

- **Auth required:** No.
- **200** — `{ "success": true, "data": { /* Job object, see §2 */ } }`
- **400** — malformed `:id` (not a valid MongoDB ObjectId): `{ "success": false, "error": "Invalid job ID." }`
- **404** — `{ "success": false, "error": "Job not found." }` — returned for a nonexistent id **and** for an id belonging to a real-but-inactive job, identically (the endpoint never reveals which case occurred).
- **500** — `{ "success": false, "error": "Failed to retrieve job. Please try again later." }`

---

## 5. Job Create / Update / Delete

**These three endpoints require authentication (a valid JWT) but do NOT enforce a true admin/owner role — there is no role or ownership field anywhere in the current data model.** Any signed-up, logged-in user can currently create, edit, or delete any job. This is a known, explicitly documented limitation (see `PHASE_1I5_REPORT.md` §6/§7) — not something the frontend should assume is more restrictive than it is. Do not build a UI that implies "only admins can do this" unless/until a real role system exists server-side.

### `POST /api/jobs`
- **Auth required:** Yes.
- **Body:** any subset of `title`, `company`, `description`, `apply_link`, `location`, `tags`, `normalized_skills`, `salary`, `job_type`, `is_remote`, `experience_level`, `is_tech_relevant`, `tech_relevance_source`, `source_category`, `logo`, `date_posted`. **Any other field in the body is silently ignored** (a whitelist, not a mass-assignment surface) — `status`, `source`, `source_id`, `dedup_fingerprint`, etc. can never be set this way; `source` is always forced to `"manual"`.
- **201** — `{ "success": true, "data": { /* Job object, see §2 */ } }`
- **400** — schema validation failure (e.g. missing required `title`): `{ "success": false, "error": "Invalid job data.", "details": ["Path `title` is required."] }`
- **401** — unauthenticated: `{ "message": "No token, auth denied" }` (note: this specific shape, not `{success,error}` — it comes from the shared auth middleware, before this endpoint's own logic ever runs).
- **500** — `{ "success": false, "error": "Failed to create job. Please try again later." }`

### `PUT /api/jobs/:id`
- **Auth required:** Yes.
- **Body:** same whitelist as `POST /api/jobs`, all fields optional (partial update).
- **200** — `{ "success": true, "data": { /* updated Job object */ } }`
- **400** — malformed `:id`, or a validation failure on the fields actually being changed.
- **401** — unauthenticated (same shape as above).
- **404** — `{ "success": false, "error": "Job not found." }`
- **500** — generic failure.

### `DELETE /api/jobs/:id`
- **Auth required:** Yes.
- **204** — no body. Returned even if the id didn't match any document (idempotent-delete semantics — deleting something already gone is not treated as an error).
- **400** — malformed `:id`.
- **401** — unauthenticated.
- **500** — generic failure.

---

## 6. Save-Job Endpoints

Both require authentication and always operate on the **authenticated caller's own** saved-jobs list — there is no way to act on another user's account through these endpoints, even by supplying a different id in the body.

### `POST /api/user/savejob`
- **Body:** `{ "jobId": "<MongoDB ObjectId string>" }`
- **200** — `{ "success": true, "savedJobs": ["<jobId>", ...] }` (the full updated list of saved job ids, as strings)
- **400** — malformed `jobId`: `{ "error": "Invalid job ID." }` — **note: no `success` key on this error response**, unlike the job endpoints in §3–5.
- **401** — unauthenticated: `{ "message": "No token, auth denied" }`.
- **404** — `{ "error": "User not found" }` (edge case — the authenticated user's own record no longer exists).
- **500** — `{ "error": "Failed to save job. Please try again later." }`

### `POST /api/user/issaved`
- **Body:** `{ "jobId": "<MongoDB ObjectId string>" }`
- **200** — `{ "isSaved": true }` or `{ "isSaved": false }` — **note: no `success` key at all, on success or error.**
- **400** / **401** / **404** / **500** — same shapes as `POST /api/user/savejob` above.

---

## 7. Profile Endpoints

Both require authentication and always operate on the authenticated caller's own account.

### `GET /api/user/profile`
- **200** — the user document with the password field excluded, returned **as a bare object, no `{success,data}` wrapper**:
```json
{ "_id": "...", "name": "Ayushi", "email": "ayushi@example.com", "savedJobs": ["<jobId>", ...], "__v": 0 }
```
- **401** — unauthenticated.
- **404** — `{ "error": "User not found" }` (edge case).
- **500** — `{ "error": "Failed to retrieve profile. Please try again later." }`

### `PUT /api/user/profile`
- **Body:** `{ "name"?: string, "email"?: string }` — only these two fields are ever applied; anything else in the body is ignored.
- **200** — the updated user object, password excluded, again as a **bare object** (no wrapper).
- **400** — `{ "error": "Email already in use." }` if the new email collides with another account (the schema's unique index).
- **401** — unauthenticated.
- **404** — `{ "error": "User not found" }` (edge case).
- **500** — `{ "error": "Failed to update profile. Please try again later." }`

---

## 8. Error Response Shape — Summary

There is **no single universal error envelope** across this API today. Three conventions coexist:

| Endpoint family | Success shape | Error shape |
|---|---|---|
| `/api/auth/*` | `{ msg }` or `{ token, user }` | `{ msg }` |
| `/api/jobs*` (all 5 routes) | `{ success: true, data, [pagination] }` | `{ success: false, error, [details] }` |
| `/api/user/*` | Bare object (profile), or `{ success: true, savedJobs }` (save-job), or `{ isSaved }` (is-saved) | `{ error }` — no `success` key |
| `authMiddleware` itself (401 on any protected route) | — | `{ message }` — a fourth, distinct key name |

The frontend's API layer should branch on the specific endpoint being called, not assume one shared response-parsing function will work for all of them. This inconsistency is a known, documented, deferred item — see `PHASE_1I5_REPORT.md` §4/§6 for why it wasn't unified in this phase.

**What is consistent everywhere:** every error response is JSON with a human-readable string message; no endpoint ever includes a raw stack trace, a MongoDB error object, a password, a JWT, or `process.env` contents in any response body, on any path, verified by both static code review and deterministic tests (`PHASE_1I5_REPORT.md` §7).

---

## 9. Known Data Limitations (current live dataset, last verified Phase 1I-2/1H-4)

- **113 total active jobs**, 19 from Adzuna, 94 from RemoteOK (plus 113 legacy documents invisible to the API — §2).
- **0 jobs classified as `fresher`** in the most recent ingestion run — a query-strategy/data-availability fact, not a bug. A dedicated `fresher`-targeted Adzuna query would surface some (per `ADZUNA_LIVE_TEST.md`), but the scheduler does not currently run one.
- **0 of 113 active jobs have a populated `salary.max`** — do not build salary-dependent UI (e.g. salary-range filters) as a primary feature without accounting for this.
- **RemoteOK jobs never have structured `location.city`/`.state`/`.country`** — only `location.raw`/`.display_name`. Country-based filtering (`?country=India`) will only ever match Adzuna-sourced jobs today.
- **`tags` is effectively always empty for Adzuna jobs.**

---

*This contract reflects the backend exactly as it exists after Phase 1I-5. It is not a target/aspirational design — every shape and status code above was read from the actual current source and, where noted, live-verified against a running server. See `PHASE_1I5_REPORT.md` for the full audit this document was produced from.*
