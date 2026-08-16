import React from "react";
import "./About.scss";
export default function About() {
  return (
    <div className="about-page">
      <h2>About JobPortal</h2>
      <p>
        JobPortal is a modern job finding platform focused on startups, tech, and remote opportunities.
        Our mission is to help you land your next role, fast!
      </p>
      <div className="about__highlight">
        <span>🚀 Over 10,000 jobs posted</span>
        <span>🌎 Remote & global companies</span>
        <span>💼 Hand-checked employers</span>
      </div>
    </div>
  );
}
