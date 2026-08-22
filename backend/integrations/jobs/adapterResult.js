// Small shared result/error convention used by every source adapter under
// backend/integrations/jobs/. Adapters return raw source data only — no
// normalization, classification, or MongoDB access happens here or in the
// adapters themselves. This just keeps every adapter's return shape
// predictable for whatever calls them next (Phase 1E ingestion code).

export function success(source, jobs, meta = {}) {
  return {
    ok: true,
    source,
    jobs,
    meta,
    error: null,
    fetchedAt: new Date(),
  };
}

export function failure(source, error) {
  return {
    ok: false,
    source,
    jobs: [],
    meta: {},
    error,
    fetchedAt: new Date(),
  };
}

// error.type is one of:
//   "missing_credentials" | "auth_failed" | "http_error" |
//   "timeout" | "network_error" | "malformed_response"
export function adapterError(type, message, extra = {}) {
  return { type, message, ...extra };
}
