import { useEffect, useReducer } from "react";
import { useParams, Link } from "react-router-dom";
import JobDetail from "../JobDetail/JobDetail";
import { getJobById } from "../../services/jobsApi.js";
import { jobDetailReducer, getInitialJobDetailState, JOB_DETAIL_STATUS } from "../../utils/jobDetailState.js";
import "../JobDetail/JobDetail.scss";

// Job detail route, state machine
export default function JobDescription() {
  const { id } = useParams();
  const [state, dispatch] = useReducer(jobDetailReducer, undefined, getInitialJobDetailState);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    getJobById(id)
      .then((job) => {
        if (!cancelled) dispatch({ type: "FETCH_SUCCESS", job });
      })
      .catch((error) => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR", error });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === JOB_DETAIL_STATUS.LOADING) {
    return <div className="job-detail-status loading" role="status" aria-live="polite">Loading job details...</div>;
  }

  if (state.status === JOB_DETAIL_STATUS.NOT_FOUND || state.status === JOB_DETAIL_STATUS.INVALID_ID) {
    return (
      <div className="job-detail-status not-found" role="status">
        <h2>Job not found</h2>
        <p>
          {state.status === JOB_DETAIL_STATUS.INVALID_ID
            ? "That job link doesn't look valid."
            : "This job may have been filled, removed, or never existed."}
        </p>
        <Link to="/jobs" className="back-to-listing">Back to job listings</Link>
      </div>
    );
  }

  if (state.status === JOB_DETAIL_STATUS.ERROR) {
    return (
      <div className="job-detail-status error" role="alert">
        <h2>Something went wrong</h2>
        <p>{state.message || "Could not load this job right now. Please try again."}</p>
        <Link to="/jobs" className="back-to-listing">Back to job listings</Link>
      </div>
    );
  }

  return <JobDetail job={state.job} />;
}
