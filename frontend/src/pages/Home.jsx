import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{
      minHeight: "70vh",
      padding: "40px 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#e7e2f7"
    }}>
      <h1 style={{
        color: "#5f43b2",
        fontWeight: 800,
        fontSize: "2.5rem",
        marginBottom: "2rem"
      }}>
        Find your dream job in start-up
      </h1>
      <div style={{
        background: "#fff",
        boxShadow: "0 2px 24px rgba(95,67,178,0.09)",
        borderRadius: 16,
        padding: 32,
        minWidth: 320,
        marginBottom: 18,
        color: "#111"
      }}>
        <h2 style={{color: "#7b42f6", fontSize: "1.3rem", fontWeight: "bold"}}>Frontend Developer</h2>
        <div style={{color: "#555", fontSize: "15px"}}>Remote | Full-time</div>
        <div style={{marginTop: "16px"}}>
          <Link
            to="/jobs/1"
            style={{
              background: "#2b175d",
              color: "#fff",
              padding: "10px 22px",
              borderRadius: "7px",
              fontWeight: 500,
              textDecoration: "none"
            }}
          >
            Apply Now
          </Link>
        </div>
      </div>
      {/* Add more job cards here if you want */}
    </div>
  );
}
