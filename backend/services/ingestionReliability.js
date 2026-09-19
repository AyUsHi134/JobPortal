/** Bounded backoff retry wrapper */

// Only transient errors retried
const RETRYABLE_ERROR_TYPES = new Set(["timeout", "network_error"]);

// 5xx retried; 4xx not
function isRetryableError(error) {
  if (!error || typeof error !== "object") return false;
  if (RETRYABLE_ERROR_TYPES.has(error.type)) return true;
  if (error.type === "http_error" && typeof error.status === "number" && error.status >= 500) {
    return true;
  }
  return false;
}

// Small retry budget protects quota
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 500;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps fetch with transient retry
 * @param {Function} fetchFn Adapter fetch function
 * @param {object} [options]
 * @param {number} [options.maxAttempts=2]
 * @param {number} [options.baseDelayMs=500]
 * @param {Function} [options.sleep] Injectable for tests
 */
export function withRetry(fetchFn, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  return async function fetchWithRetry(...args) {
    let lastResult;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      lastResult = await fetchFn(...args);

      if (lastResult && lastResult.ok) break;
      if (!isRetryableError(lastResult && lastResult.error)) break;
      if (attempt === maxAttempts) break;

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }

    return {
      ...lastResult,
      meta: { ...(lastResult && lastResult.meta), attempts },
    };
  };
}

export { isRetryableError, RETRYABLE_ERROR_TYPES, DEFAULT_MAX_ATTEMPTS, DEFAULT_BASE_DELAY_MS };
