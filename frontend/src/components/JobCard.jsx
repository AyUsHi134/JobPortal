import React from "react";

const JobCard = ({ job }) => (
  <div style={{
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 2px 16px rgba(95,67,178,0.07)",
    padding: "1.3rem 1.6rem",
    marginBottom: "1.4rem",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  }}>
    <h3 style={{ color: "#5F43B2", margin: 0 }}>{job.position}</h3>
    <div style={{ color: "#666" }}>
      {job.company && <b>{job.company}</b>} 
      {job.location && <> · {job.location}</>}
    </div>
    <div style={{ color: "#888", fontSize: 14 }}>
      {job.tags && job.tags.slice(0, 4).join(", ")}
    </div>
    <a href={job.url} target="_blank" rel="noopener noreferrer">
      <button style={{
        background: "#5F43B2",
        color: "#fff",
        border: "none",
        padding: "12px 28px",
        borderRadius: "6px",
        fontWeight: 600,
        fontSize: 15,
        marginTop: "6px",
        cursor: "pointer"
      }}>Apply Now</button>
    </a>
  </div>
);

export default JobCard;
