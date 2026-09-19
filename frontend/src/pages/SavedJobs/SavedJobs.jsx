import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { getProfile } from "../../services/userApi.js";
import { loadSavedJobs } from "../../utils/savedJobsLoader.js";
import JobCard from "../../components/JobCard/JobCard.jsx";
import AuthRequired from "../../components/AuthRequired/AuthRequired.jsx";
import "./SavedJobs.scss";

// Saved jobs page via profile
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

  // Drop card after confirmed removal
  const handleUnsaved = (jobId) => {
    setJobs((prev) => prev.filter((job) => job._id !== jobId));
  };

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
        <div className="saved-jobs-grid">
          {jobs.map((job) => (
            <div className="saved-jobs-grid__item" key={job._id}>
              <JobCard job={job} onUnsaved={handleUnsaved} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
