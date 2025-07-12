import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // TODO: Replace with your backend API
    alert("Signed up (mock, no backend call)");
    navigate("/login");
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#eae4f6"
    }}>
      <form
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 28px rgba(95,67,178,0.12)",
          padding: "2rem 2.6rem",
          minWidth: 320,
        }}
        onSubmit={handleSubmit}
      >
        <h2 style={{ color: "#5f43b2", fontWeight: 800, marginBottom: 20 }}>Sign up</h2>
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          required
          style={{ marginBottom: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          style={{ marginBottom: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          style={{ marginBottom: 18, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{
          background: "#5f43b2",
          color: "#fff",
          width: "100%",
          padding: "12px 0",
          borderRadius: 7,
          fontWeight: 700,
          border: "none",
          marginBottom: 16
        }}>
          Create Account
        </button>
        <div style={{ textAlign: "center" }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
