import React from "react";
import { useNavigate } from "react-router-dom";
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

// Phase 2C: fixes the old-schema assumptions FRONTEND_AUDIT.md §8
// identified — `job.location` is a structured object now, not a flat
// string; there is no `job.type`/`job.category` field on the finalized
// schema (replaced with real `job_type`/`experience_level`/`is_remote`/
// `is_tech_relevant` where a confirmed value exists). All formatting
// goes through utils/jobDisplay.js, which returns `null` for anything
// not confidently known — this component never fabricates a value.
//
// Phase 2E: save-state fetch/save logic moved into the shared
// hooks/useSavedJobState.js (also used by JobDetail.jsx, avoiding
// duplicated logic between the two) — this component only decides what
// to render via the pure utils/savedJobUi.js#getSaveButtonState.
//
// Phase 2G-2: rebuilt for the green theme + a stricter, honest badge
// system. `source` is never shown (backend field is untouched — only its
// presentation here is removed, per this phase's own instruction). The
// card's only action besides Save is "View Details" -> `/job/:id`; the
// original apply URL is never linked directly from the card (that flow
// now lives one step later, on Job Detail's own Apply action, untouched
// by this phase). A logged-out card's Save control always shows the same
// plain label regardless of auth state — the login-prompt copy that
// JobDetail's Save button still carries is never shown here — and still
// routes to /login via the same shared "login" action the hook/util
// already provide, so no unauthorized request is ever attempted and the
// shared savedJobUi.js decision logic (also used by JobDetail, out of
// this phase's scope) is not altered.
//
// Phase 2G-7C: reordered the card's field layout to Company -> Title ->
// Location -> Salary -> Posted date -> Tags/badges -> Footer (previously
// badges sat in a fixed slot ABOVE the company row). None of the
// underlying data/formatting logic changed — every field is still
// computed exactly as before via the same unmodified jobDisplay.js
// formatters; only the JSX render ORDER moved. Because badges no longer
// sit above content that needs a stable position, the old fixed
// `min-height` badge slot is gone too — the whole "Tags/badges" block
// (semantic badges + skill chips together) is now conditionally rendered
// only when there's at least one badge or skill, so a job with neither
// never leaves a large empty gap before the footer. The Save button also
// gained a bookmark icon (filled when saved, outlined otherwise) beside
// its existing text label — a visual addition only; its click handler,
// disabled state, and aria-pressed wiring are unchanged.
export default function JobCard({ job }) {
  const navigate = useNavigate();
  const { isAuthenticated, isSaved, isSaving, error: saveError, save } = useSavedJobState(job._id);
  const rawSaveButtonState = getSaveButtonState({ isAuthenticated, isSaved, isSaving });
  const saveButton =
    rawSaveButtonState.action === "login"
      ? { ...rawSaveButtonState, label: "Save" }
      : rawSaveButtonState;

  const handleSaveClick = () => {
    if (saveButton.action === "login") {
      navigate("/login");
      return;
    }
    if (saveButton.action === "save") {
      save();
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

      {/* Tags/badges — deliberately AFTER posted date, and only rendered
          at all when there's at least one real badge or skill, so a job
          with neither never leaves a large empty gap before the footer
          (badges/skills used to occupy a fixed slot at the top of the
          card; now that they sit here instead, that fixed reservation is
          no longer needed or wanted). Badge priority/ordering
          (Remote -> Experience -> Tech) and the honest-data rules behind
          each (never fabricated, never duplicating a Remote location) are
          unchanged from every prior phase. */}
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
