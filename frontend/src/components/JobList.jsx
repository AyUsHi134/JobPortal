// src/components/JobList.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function JobList({ jobs }) {
  if (!jobs.length) return <div style={{ textAlign: "center", color: "#999", margin: 48 }}>No jobs found.</div>;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
      gap: 32,
      justifyContent: "center",
      margin: "0 auto",
      maxWidth: 800
    }}>
      {jobs.map(job => (
        <div key={job._id} style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 24px rgba(95,67,178,0.09)",
          padding: 28,
          minWidth: 300
        }}>
          <h2 style={{color: "#7b42f6", fontSize: "1.25rem", fontWeight: 700, margin: 0}}>{job.title}</h2>
          <div style={{color: "#5f43b2", margin: "10px 0 4px 0"}}>{job.company} | {job.location} | {job.type}</div>
          <p style={{ color: "#666", fontSize: 15, minHeight: 38 }}>{job.description?.slice(0, 65)}...</p>
          <Link to={`/jobs/${job._id}`} style={{
            display: "inline-block",
            marginTop: 12,
            background: "#2b175d",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: "7px",
            fontWeight: 500,
            textDecoration: "none"
          }}>Apply Now</Link>
        </div>
      ))}
    </div>
  );
}
