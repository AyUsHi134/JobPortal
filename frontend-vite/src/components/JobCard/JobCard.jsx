import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import "./JobCard.scss";

export default function JobCard({ job, currentUser }) {
  const [isSaved, setIsSaved] = useState(false);
  const navigate = useNavigate(); 

  useEffect(() => {
    const checkSaved = async () => {
      if (!currentUser?._id) return;
      const res = await fetch("http://localhost:5000/api/user/issaved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser._id, jobId: job._id }),
      });
      const data = await res.json();
      setIsSaved(data.isSaved);
    };
    checkSaved();
  }, [currentUser, job._id]);


  const handleSave = async () => {
    if (!currentUser?._id) {
      alert("Please log in to save jobs!");
      return;
    }
    const res = await fetch("http://localhost:5000/api/user/savejob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser._id, jobId: job._id }),
    });
    if (res.ok) setIsSaved(true);
  };


  const handleApply = () => {
    navigate(`/job/${job._id}`);
  };

  return (
    <div className="modern-job-card">
     
      <div className="job-card-header">
        <div className="job-category">
          <span className="category-dot"></span>
          {job.category || "Software Engineering"}
        </div>
      </div>

      
      <div className="job-company-row">
        {job.logo && (
          <img src={job.logo} alt={job.company} className="job-logo" />
        )}
        <span className="job-company">{job.company}</span>
      </div>

      
      <div className="job-title">{job.title}</div>

      
      <div className="job-card-meta">
        <div className="job-location">
          <b>{job.location}</b>
        </div>
        <span className="job-type">{job.type}</span>
      </div>

      
      <div className="job-card-actions centered">
        <button className="apply-btn" onClick={handleApply}>Apply</button> {/* ✅ updated */}
        <button
          className={`save-btn${isSaved ? " saved" : ""}`}
          onClick={handleSave}
          disabled={isSaved}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
