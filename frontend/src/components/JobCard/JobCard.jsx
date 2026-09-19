import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import { useSavedJobState } from "../../hooks/useSavedJobState.js";
import { getSaveButtonState } from "../../utils/savedJobUi.js";
import {
  formatLocation,
  formatSalary,
  formatExperience,
  formatRemoteBadge,
  formatTechRelevance,
  formatDatePosted,
  isDuplicateRemoteLocation,
  getExperienceBadgeTone,
} from "../../utils/jobDisplay.js";
import "./JobCard.scss";

// Job card, structured schema fields
export default function JobCard({ job, onUnsaved }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isSaved, isSaving, error: saveError, save, unsave } = useSavedJobState(job._id);
  const rawSaveButtonState = getSaveButtonState({ isAuthenticated, isSaved, isSaving });
  const saveButton =
    rawSaveButtonState.action === "login"
      ? { ...rawSaveButtonState, label: "Save" }
      : rawSaveButtonState;

  const handleSaveClick = async () => {
    if (saveButton.action === "login") {
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    if (saveButton.action === "save") {
      save();
      return;
    }
    if (saveButton.action === "unsave") {
      const didUnsave = await unsave();
      // Optional parent removal callback
      if (didUnsave && onUnsaved) onUnsaved(job._id);
    }
  };

  const handleViewDetails = () => {
    navigate(`/job/${job._id}`);
  };

  const isRemote = job.is_remote === true;
  const remoteBadgeText = formatRemoteBadge(job.is_remote);
  const experienceText = formatExperience(job.experience_level);
  const experienceTone = getExperienceBadgeTone(job.experience_level);
  const techText = formatTechRelevance(job.is_tech_relevant);

  const rawLocationText = formatLocation(job.location);
  const locationText = isDuplicateRemoteLocation(isRemote, rawLocationText) ? null : rawLocationText;

  const salaryText = formatSalary(job.salary);
  const postedText = formatDatePosted(job.date_posted);
  const skills = Array.isArray(job.normalized_skills) ? job.normalized_skills.slice(0, 3) : [];
  const hasBadges = Boolean(remoteBadgeText || experienceText || techText);
  const hasTagsOrBadges = hasBadges || skills.length > 0;

  return (
    <div className="modern-job-card">
      {/* Details and content area */}
      <div className="job-card-details">
        <div className="job-company-row">
          {job.logo && (
            <img src={job.logo} alt={job.company} className="job-logo" />
          )}
          <span className="job-company">{job.company}</span>
        </div>

        <div className="job-title">{job.title}</div>

        {locationText && (
          <div className="job-location">{locationText}</div>
        )}

        {salaryText && <div className="job-salary">{salaryText}</div>}

        {postedText && (
          <div className="job-card-meta">
            <span className="job-posted">{postedText}</span>
          </div>
        )}

        {/* Tags and badges */}
        {hasTagsOrBadges && (
          <div className="job-tags-section">
            {hasBadges && (
              <div className="job-badges">
                {remoteBadgeText && <span className="badge badge-remote">{remoteBadgeText}</span>}
                {experienceText && (
                  <span className={`badge badge-experience badge-experience--${experienceTone}`}>{experienceText}</span>
                )}
                {techText && <span className="badge badge-tech">{techText}</span>}
              </div>
            )}
            {skills.length > 0 && (
              <div className="job-skills">
                {skills.map((skill) => (
                  <span className="skill-chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action area */}
      <div className="job-card-actions">
        <button className="view-details-btn" onClick={handleViewDetails}>
          View Details
        </button>
        <button
          className={`save-btn${isSaved ? " saved" : ""}`}
          onClick={handleSaveClick}
          disabled={saveButton.disabled}
          aria-pressed={isSaved}
        >
          {isSaved ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
          {saveButton.label}
        </button>
      </div>
      {saveError && <p className="job-save-error" role="alert">{saveError}</p>}
    </div>
  );
}
