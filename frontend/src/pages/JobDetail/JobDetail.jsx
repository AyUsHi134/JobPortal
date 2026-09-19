import { Link, useLocation, useNavigate } from "react-router-dom";
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

// Job detail on finalized schema
export default function JobDetail({ job }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isSaved, isSaving, error: saveError, save, unsave } = useSavedJobState(job._id);
  const saveButton = getSaveButtonState({ isAuthenticated, isSaved, isSaving });

  const handleSaveClick = () => {
    if (saveButton.action === "login") {
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    if (saveButton.action === "save") {
      save();
    }
    if (saveButton.action === "unsave") {
      unsave();
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
