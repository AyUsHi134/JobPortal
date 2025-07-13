// src/components/BlogPreviewSection.jsx
import React from "react";

const blogs = [
  { title: "How to Nail Your Next Interview", link: "#", date: "Jul 2024" },
  { title: "Resume Hacks for Startups", link: "#", date: "Jun 2024" },
  { title: "Top 10 Skills in 2025", link: "#", date: "May 2024" }
];

export default function BlogPreviewSection() {
  return (
    <section style={{ maxWidth: 900, margin: "60px auto 0", padding: "0 16px" }}>
      <h3 style={{ textAlign: "center", color: "#5f43b2", fontWeight: 700, fontSize: 26, marginBottom: 18 }}>
        Career Tips & Resources
      </h3>
      <div style={{
        display: "flex",
        gap: 32,
        justifyContent: "center"
      }}>
        {blogs.map(b => (
          <a key={b.title} href={b.link} style={{
            background: "#faf6ff",
            borderRadius: 14,
            boxShadow: "0 2px 12px rgba(95,67,178,0.06)",
            padding: 24,
            minWidth: 220,
            flex: "1 0 180px",
            color: "#2b175d",
            textDecoration: "none"
          }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{b.title}</div>
            <div style={{ color: "#5f43b2", fontSize: 14 }}>{b.date}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
