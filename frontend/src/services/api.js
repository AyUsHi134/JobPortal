import axios from "axios";

// Backend base URL, env-configurable
const DEFAULT_BASE_URL = "http://localhost:5000";
export const API_BASE_URL = import.meta.env?.VITE_API_URL || DEFAULT_BASE_URL;

// Auth storage

const AUTH_STORAGE_KEY = "jobportal_auth";

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

/** Returns stored session or null */
export function getStoredAuth() {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.token) return null;
    return { token: parsed.token, user: parsed.user ?? null };
  } catch {
    // Malformed value means logged out
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

// 401 subscription

const unauthorizedListeners = new Set();

/** Registers 401 callback, returns unsubscribe */
export function onUnauthorized(callback) {
  unauthorizedListeners.add(callback);
  return () => unauthorizedListeners.delete(callback);
}

function notifyUnauthorized() {
  for (const callback of unauthorizedListeners) callback();
}

// Safe error normalization

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
const RATE_LIMITED_MESSAGE = "Too many requests — please wait a moment and try again.";

function extractMessage(data) {
  if (!data || typeof data !== "object") return GENERIC_ERROR_MESSAGE;
  return data.error || data.msg || data.message || GENERIC_ERROR_MESSAGE;
}

// Parses Retry-After seconds
function parseRetryAfterSeconds(headers) {
  const raw = headers?.["retry-after"];
  if (raw === undefined || raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

// 429 gets specific message
function buildRateLimitMessage(data, retryAfterSeconds) {
  if (data && typeof data === "object") {
    const backendMessage = data.error || data.msg || data.message;
    if (backendMessage) return backendMessage;
  }
  if (retryAfterSeconds !== null) {
    const unit = retryAfterSeconds === 1 ? "second" : "seconds";
    return `Too many requests — please try again in ${retryAfterSeconds} ${unit}.`;
  }
  return RATE_LIMITED_MESSAGE;
}

function normalizeError(error) {
  if (error.response) {
    const { status, data, headers } = error.response;
    const details = Array.isArray(data?.details) ? data.details : null;
    if (status === 429) {
      const retryAfterSeconds = parseRetryAfterSeconds(headers);
      return new ApiError(buildRateLimitMessage(data, retryAfterSeconds), { status, details });
    }
    return new ApiError(extractMessage(data), { status, details });
  }
  if (error.request) {
    // No response received
    return new ApiError(NETWORK_ERROR_MESSAGE, { status: null });
  }
  return new ApiError(GENERIC_ERROR_MESSAGE, { status: null });
}

// Centralized HTTP client

// Credentials needed for guest cookie
export const apiClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

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
      // Clear stale token on 401
      clearStoredAuth();
      notifyUnauthorized();
    }
    return Promise.reject(normalizeError(error));
  }
);
