import axios from "axios";

// Base URL of the backend API. Configurable via VITE_API_URL (see
// .env.example) for local dev overrides and future non-localhost
// deployments — falls back to the same localhost:5000 value every
// component already hardcoded before this phase, so local dev behavior
// is unchanged by default. `import.meta.env?.VITE_API_URL` is safe to
// read outside Vite too (e.g. from the plain-Node deterministic test
// scripts under src/tests/) — `import.meta.env` is simply `undefined`
// there, and optional chaining falls through to the default.
const DEFAULT_BASE_URL = "http://localhost:5000";
export const API_BASE_URL = import.meta.env?.VITE_API_URL || DEFAULT_BASE_URL;

// ---------------------------------------------------------------------------
// Auth storage — the single source of truth for the persisted JWT + user.
// Deliberately plain functions (not React state) so both the axios
// interceptor below and AuthContext can read/write the same underlying
// storage without a circular dependency between this module and React.
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = "jobportal_auth";

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

/** Returns `{ token, user }` if a valid session is stored, else `null`. Never throws. */
export function getStoredAuth() {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.token) return null;
    return { token: parsed.token, user: parsed.user ?? null };
  } catch {
    // A malformed/legacy stored value (e.g. from before this phase, when
    // only {name,email} was ever stored under a different key) must never
    // crash the app — treat it as "not logged in."
    return null;
  }
}

export function setStoredAuth(token, user) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
}

export function clearStoredAuth() {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getToken() {
  return getStoredAuth()?.token ?? null;
}

// ---------------------------------------------------------------------------
// 401 subscription — lets AuthContext synchronously clear its React state
// when any authenticated request comes back unauthorized (e.g. an expired
// token), without this module importing React/AuthContext (keeping the
// service layer independent of page/UI-state logic, per this phase's
// explicit instruction). No redirect is performed here — see the response
// interceptor below.
// ---------------------------------------------------------------------------

const unauthorizedListeners = new Set();

/** Registers a callback to run whenever a request fails with 401. Returns an unsubscribe function. */
export function onUnauthorized(callback) {
  unauthorizedListeners.add(callback);
  return () => unauthorizedListeners.delete(callback);
}

function notifyUnauthorized() {
  for (const callback of unauthorizedListeners) callback();
}

// ---------------------------------------------------------------------------
// Safe error normalization — converts any axios failure (validation error,
// auth failure, network failure, unexpected 500) into one small, predictable
// shape every caller can rely on, without ever leaking a raw stack trace,
// Mongo/axios internals, or request configuration (e.g. headers, which could
// contain the Authorization token). The backend itself already never sends
// that kind of detail (verified in PHASE_1I5_REPORT.md), but this is a
// deliberate second layer of defense on the client, and — more importantly
// — it also papers over BACKEND_API_CONTRACT.md §8's own documented
// inconsistency (the backend uses three different error-key conventions:
// `msg`, `error`, `message`), so callers never need to know which one a
// given endpoint uses.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(message, { status = null, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Please check your connection and try again.";

function extractMessage(data) {
  if (!data || typeof data !== "object") return GENERIC_ERROR_MESSAGE;
  return data.error || data.msg || data.message || GENERIC_ERROR_MESSAGE;
}

function normalizeError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const details = Array.isArray(data?.details) ? data.details : null;
    return new ApiError(extractMessage(data), { status, details });
  }
  if (error.request) {
    // The request was made but no response was ever received (offline,
    // CORS failure, backend down, etc.) — never echo axios's own message
    // here, since it can include the request URL/config.
    return new ApiError(NETWORK_ERROR_MESSAGE, { status: null });
  }
  return new ApiError(GENERIC_ERROR_MESSAGE, { status: null });
}

// ---------------------------------------------------------------------------
// The centralized HTTP client. Every service module (authApi.js, jobsApi.js,
// userApi.js) issues requests through this one instance — no component or
// service function should construct its own axios instance or call fetch
// directly.
// ---------------------------------------------------------------------------

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expiry handling (per this phase's explicit scope — no
      // refresh-token logic, since the backend contract doesn't offer
      // one): clear the stale token/state and let the request fail
      // normally. The caller decides what the user sees next; this layer
      // never redirects on its own, avoiding any risk of a redirect loop.
      clearStoredAuth();
      notifyUnauthorized();
    }
    return Promise.reject(normalizeError(error));
  }
);
