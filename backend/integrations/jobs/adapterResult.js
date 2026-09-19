// Shared adapter result convention

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

// error.type allowed values
export function adapterError(type, message, extra = {}) {
  return { type, message, ...extra };
}
