// src/components/CompaniesSection.jsx
import React from "react";

const companies = [
  { name: "Acme Inc.", logo: "https://dummyimage.com/60x60/7b42f6/fff&text=A" },
  { name: "Tech Solutions", logo: "https://dummyimage.com/60x60/5f43b2/fff&text=T" },
  { name: "Startup Labs", logo: "https://dummyimage.com/60x60/2b175d/fff&text=S" }
];

export default function CompaniesSection() {
  return (
    <section style={{ maxWidth: 900, margin: "60px auto 0", padding: "0 16px" }}>
      <h3 style={{ textAlign: "center", color: "#5f43b2", fontWeight: 700, fontSize: 26, marginBottom: 18 }}>
        Top Companies Hiring
      </h3>
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 34
      }}>
        {companies.map(c => (
          <div key={c.name} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <img src={c.logo} alt={c.name} style={{ borderRadius: "50%", marginBottom: 8 }} />
            <div style={{ color: "#7b42f6", fontWeight: 600 }}>{c.name}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
