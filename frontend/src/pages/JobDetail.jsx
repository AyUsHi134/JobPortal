import React from "react";
import { useParams } from "react-router-dom";

export default function JobDetail() {
  // In real app, you'd fetch job by ID here using useParams.
  // We'll just use dummy content.
  const { id } = useParams();

  return (
    <div style={{
      minHeight: "70vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#ede7f6"
    }}>
      <div style={{
        background: "#fff",
        marginTop: "3rem",
        padding: "2.5rem",
        borderRadius: "1rem",
        boxShadow: "0 2px 24px rgba(95,67,178,0.10)",
        minWidth: 340
      }}>
        <h2 style={{color: "#7b42f6", fontWeight: 700}}>Frontend Developer</h2>
        <div style={{color: "#888", marginBottom: 10}}>Remote | Full-time</div>
        <p style={{color: "#444", lineHeight: "1.7"}}>
          {/* You can use job ID if fetching dynamically */}
          Job ID: {id}
          <br />
          We are looking for a passionate Frontend Developer to join our team! Work with modern React, beautiful UI, and ship real products.
        </p>
        <button
          style={{
            background: "#2b175d",
            color: "#fff",
            padding: "12px 32px",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            marginTop: "1.6rem",
            cursor: "pointer"
          }}
        >
          Apply Now
        </button>
      </div>
    </div>
  );
}
