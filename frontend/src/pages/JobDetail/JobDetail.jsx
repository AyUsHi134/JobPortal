import { Link, useNavigate } from "react-router-dom";
import {
  formatLocation,
  formatSalary,
  formatExperience,
  formatRemote,
  formatTechRelevance,
  formatSource,
  formatDatePosted,
  isValidApplyLink,
  isDuplicateRemoteLocation,
  descriptionToParagraphs,
  getExperienceBadgeTone,
} from "../../utils/jobDisplay.js";
import { useSavedJobState } from "../../hooks/useSavedJobState.js";
import { getSaveButtonState } from "../../utils/savedJobUi.js";
import "./JobDetail.scss";

// Phase 2D: rebuilt against the finalized normalized Job schema
// (BACKEND_API_CONTRACT.md §2). Previously assumed `job.location` was a
// flat string and rendered an internal hiring-stage field the backend
// never returns (per BACKEND_API_CONTRACT.md §2 — that block simply
// never fired), plus rendered the raw description via an unsanitized
// raw-HTML-injection API (a confirmed XSS risk, FRONTEND_AUDIT.md
// §8/§10). All field rendering now goes through the same
// utils/jobDisplay.js formatters JobCard.jsx (Phase 2C) already uses —
// every formatter returns `null` for missing/unknown data, so this
// component never fabricates a value; a `null` return simply omits that
// piece of UI. `job` is always a fully-loaded, real job object here —
// loading/error/not-found states are handled one level up, in
// JobDescription.jsx.
//
// Phase 2E: added a Save action alongside Apply, using the same
// hooks/useSavedJobState.js + utils/savedJobUi.js pair JobCard.jsx uses —
// no saved-state logic was duplicated or reimplemented here.
//
// Phase 2G-4: brought into the green theme, applied JobCard's Phase
// 2G-2 duplicate-Remote-location suppression here too (a confirmed-
// remote job's location line no longer repeats a contentless "Remote"
// the badge already states), and simplified the single Apply action's
// label to read as the one clear thing it is (see PHASE_2G4_REPORT.md
// §5 for confirmation this page never had a second, separate original-
// listing control to begin with). A missing/invalid apply_link now
// renders as a real disabled <button> in the Apply action's own slot,
// rather than italic paragraph text elsewhere in the layout, so a guest
// scanning the action row sees an honest disabled control exactly where
// the working one would be, not a separate aside.
export default function JobDetail({ job }) {
  const navigate = useNavigate();
  const { isAuthenticated, isSaved, isSaving, error: saveError, save } = useSavedJobState(job._id);
  const saveButton = getSaveButtonState({ isAuthenticated, isSaved, isSaving });

  const handleSaveClick = () => {
    if (saveButton.action === "login") {
      navigate("/login");
      return;
    }
    if (saveButton.action === "save") {
      save();
    }
  };

  const isRemoteConfirmed = job.is_remote === true;
  const rawLocationText = formatLocation(job.location);
  const locationText = isDuplicateRemoteLocation(isRemoteConfirmed, rawLocationText) ? null : rawLocationText;
  const salaryText = formatSalary(job.salary);
  const experienceText = formatExperience(job.experience_level);
  const experienceTone = getExperienceBadgeTone(job.experience_level);
  const remoteText = formatRemote(job.is_remote);
  const techText = formatTechRelevance(job.is_tech_relevant);
  const sourceText = formatSource(job.source);
  const postedText = formatDatePosted(job.date_posted);
  const skills = Array.isArray(job.normalized_skills) ? job.normalized_skills : [];
  const tags = Array.isArray(job.tags) ? job.tags.filter((tag) => !skills.includes(tag)) : [];
  const paragraphs = descriptionToParagraphs(job.description);
  const hasApplyLink = isValidApplyLink(job.apply_link);

  return (
    <div className="job-detail-page">
      <div className="job-detail-container">
        <Link to="/jobs" className="back-to-listing">← Back to job listings</Link>

        <header className="job-header">
          <div className="job-badges">
            {techText && <span className="badge badge-tech">{techText}</span>}
            {remoteText && <span className="badge badge-remote">{remoteText}</span>}
            {experienceText && (
              <span className={`badge badge-experience badge-experience--${experienceTone}`}>{experienceText}</span>
            )}
          </div>

          <div className="job-company-row">
            {job.logo && <img src={job.logo} alt={job.company} className="job-logo" />}
            <span className="job-company">{job.company}</span>
          </div>

          <h1 className="job-title">{job.title}</h1>

          <div className="job-meta-row">
            {locationText && <span className="job-location">{locationText}</span>}
            {postedText && <span className="job-posted">{postedText}</span>}
            {sourceText && <span className="job-source">via {sourceText}</span>}
          </div>

          {salaryText && <div className="job-salary">{salaryText}</div>}
        </header>

        <div className="job-body">
          {skills.length > 0 && (
            <section className="job-section job-skills-section">
              <h2>Skills</h2>
              <div className="job-skills">
                {skills.map((skill) => (
                  <span className="skill-chip" key={skill}>{skill}</span>
                ))}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section className="job-section job-tags-section">
              <h2>Tags</h2>
              <div className="job-tags">
                {tags.map((tag) => (
                  <span className="tag-chip" key={tag}>{tag}</span>
                ))}
              </div>
            </section>
          )}

          <section className="job-section job-description-section">
            <h2>Description</h2>
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="job-description-empty">No description was provided for this job.</p>
            )}
          </section>
        </div>

        <div className="job-actions">
          {hasApplyLink ? (
            <a
              className="apply-btn"
              href={job.apply_link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Apply for ${job.title} at ${job.company} (opens in a new tab)`}
            >
              Apply Now ↗
            </a>
          ) : (
            <button type="button" className="apply-btn apply-btn--disabled" disabled>
              Application link unavailable
            </button>
          )}
          <button
            className={`save-btn${isSaved ? " saved" : ""}`}
            onClick={handleSaveClick}
            disabled={saveButton.disabled}
            aria-pressed={isSaved}
          >
            {saveButton.label}
          </button>
          {saveError && <p className="job-save-error" role="alert">{saveError}</p>}
        </div>
      </div>
    </div>
  );
}
