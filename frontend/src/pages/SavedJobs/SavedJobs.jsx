import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { getProfile } from "../../services/userApi.js";
import { loadSavedJobs } from "../../utils/savedJobsLoader.js";
import JobCard from "../../components/JobCard/JobCard.jsx";
import AuthRequired from "../../components/AuthRequired/AuthRequired.jsx";
import "./SavedJobs.scss";

// Phase 2E: `/saved-jobs` — linked from Navbar.jsx since before this
// phase but never registered as a route (FRONTEND_AUDIT.md §2, a
// confirmed dead link). BACKEND_API_CONTRACT.md §6 has no endpoint that
// lists a user's saved jobs directly — only GET /api/user/profile (§7)
// returns the authenticated caller's `savedJobs` array of ids. This page
// follows that actual contract rather than inventing a response shape:
// it reads the id list from the profile, then hands it to
// utils/savedJobsLoader.js#loadSavedJobs, which requests each job
// individually via jobsApi.getJobById() (Phase 2D). Both calls carry
// only the JWT — this page can never request another user's saved jobs,
// since getProfile()/getJobById() never accept or send a user id of any
// kind.
export default function SavedJobs() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [jobs, setJobs] = useState([]);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setStatus("loading");

    getProfile()
      .then((profile) => loadSavedJobs(profile.savedJobs))
      .then(({ jobs: loaded, unavailableCount: failed }) => {
        if (cancelled) return;
        setJobs(loaded);
        setUnavailableCount(failed);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message || "Could not load your saved jobs right now.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <AuthRequired message="Log in to view your saved jobs." />;
  }

  if (status === "loading") {
    return <p className="saved-jobs-status" role="status" aria-live="polite">Loading your saved jobs...</p>;
  }

  if (status === "error") {
    return <p className="saved-jobs-status saved-jobs-status--error" role="alert">{errorMessage}</p>;
  }

  return (
    <div className="saved-jobs-page">
      <h1>Saved Jobs</h1>

      {unavailableCount > 0 && (
        <p className="saved-jobs-note" role="status">
          {unavailableCount} saved {unavailableCount === 1 ? "job is" : "jobs are"} no longer available and {unavailableCount === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="saved-jobs-empty">
          You haven't saved any jobs yet. <Link to="/jobs">Browse jobs</Link>
        </p>
      ) : (
        <>
          {/* Phase 2F: an honest, visible note rather than a silently
              missing feature — BACKEND_API_CONTRACT.md §6 has no
              remove-saved-job endpoint (PHASE_2E_REPORT.md §2/§13), so no
              "Unsave" control exists anywhere in this UI. Saying so here
              is more honest than leaving a user to wonder why the Save
              button on every card below is permanently disabled once
              already saved. */}
          <p className="saved-jobs-hint">
            Jobs currently can’t be removed from this list from the app — that requires a backend feature not yet available.
          </p>
          <div className="saved-jobs-grid">
            {jobs.map((job) => (
              <div className="saved-jobs-grid__item" key={job._id}>
                <JobCard job={job} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
