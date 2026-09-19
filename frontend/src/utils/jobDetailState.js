// Pure job detail state machine

export const JOB_DETAIL_STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  NOT_FOUND: "not_found",
  INVALID_ID: "invalid_id",
  ERROR: "error",
};

/** Classifies API error into state */
export function classifyJobDetailError(error) {
  const status = error?.status;
  if (status === 404) return JOB_DETAIL_STATUS.NOT_FOUND;
  if (status === 400) return JOB_DETAIL_STATUS.INVALID_ID;
  return JOB_DETAIL_STATUS.ERROR;
}

export function getInitialJobDetailState() {
  return { status: JOB_DETAIL_STATUS.LOADING, job: null, message: null };
}

export function jobDetailReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      // Always resets job to null
      return { status: JOB_DETAIL_STATUS.LOADING, job: null, message: null };
    case "FETCH_SUCCESS":
      return { status: JOB_DETAIL_STATUS.SUCCESS, job: action.job, message: null };
    case "FETCH_ERROR":
      return { status: classifyJobDetailError(action.error), job: null, message: action.error?.message || null };
    default:
      return state;
  }
}
