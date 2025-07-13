// src/components/NewsletterSection.jsx
import React, { useState } from "react";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubscribe = e => {
    e.preventDefault();
    setMsg("Thank you for subscribing! 🚀");
    setEmail("");
  };

  return (
    <section style={{
      margin: "60px auto 0",
      padding: "32px 0",
      background: "#f4ecfd"
    }}>
      <form
        onSubmit={handleSubscribe}
        style={{ textAlign: "center" }}
      >
        <h4 style={{ color: "#7b42f6", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          Get jobs in your inbox
        </h4>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #d2bcfa",
            fontSize: 15,
            minWidth: 240
          }}
        />
        <button type="submit" style={{
          background: "#7b42f6",
          color: "#fff",
          padding: "12px 22px",
          borderRadius: 8,
          fontWeight: 700,
          border: "none",
          marginLeft: 12
        }}>
          Subscribe
        </button>
        {msg && <div style={{ color: "#5f43b2", marginTop: 12 }}>{msg}</div>}
      </form>
    </section>
  );
}
