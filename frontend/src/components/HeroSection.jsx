// src/components/HeroSection.jsx
import React from "react";

export default function HeroSection() {
  return (
    <section style={{
      textAlign: "center",
      padding: "60px 0 36px 0",
      background: "#f3eaff"
    }}>
      <h1 style={{
        color: "#7b42f6",
        fontSize: "3rem",
        fontWeight: 900,
        marginBottom: 12
      }}>
        Find your dream job in start-up
      </h1>
      <p style={{
        color: "#5f43b2",
        fontSize: "1.3rem",
        fontWeight: 500
      }}>
        Explore top opportunities handpicked for you
      </p>
    </section>
  );
}
