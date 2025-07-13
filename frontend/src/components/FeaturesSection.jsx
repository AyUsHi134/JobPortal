// src/components/FeaturesSection.jsx
import React from "react";

const features = [
  { icon: "🔥", title: "Curated Jobs", desc: "Only the best startup jobs for you." },
  { icon: "⚡", title: "Fast Application", desc: "Apply instantly, track your status." },
  { icon: "💼", title: "Expert Guidance", desc: "Career resources and interview tips." },
  { icon: "🔒", title: "Secure & Private", desc: "Your data is always protected." }
];

export default function FeaturesSection() {
  return (
    <section style={{ maxWidth: 900, margin: "60px auto 0", padding: "0 16px" }}>
      <h3 style={{ textAlign: "center", color: "#5f43b2", fontWeight: 700, fontSize: 28, marginBottom: 20 }}>Why Choose Us?</h3>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        justifyContent: "center"
      }}>
        {features.map(f => (
          <div key={f.title} style={{
            background: "#faf6ff",
            borderRadius: 14,
            boxShadow: "0 2px 16px rgba(95,67,178,0.07)",
            padding: 28,
            minWidth: 220,
            flex: "1 0 180px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ color: "#7b42f6", fontWeight: 700, fontSize: 19 }}>{f.title}</div>
            <div style={{ color: "#444", fontSize: 15 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
