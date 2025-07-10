import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        // Save auth info if needed (localStorage/token)
        alert("Login successful!");
        navigate("/profile");
      } else {
        alert(data.msg || "Login failed");
      }
    } catch {
      alert("Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ECE6F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "2.5rem",
          borderRadius: "12px",
          boxShadow: "0 2px 16px rgba(95,67,178,0.07)",
          width: "340px",
        }}
      >
        <h2 style={{ fontWeight: "bold", color: "#1A1A1A", marginBottom: "1.5rem" }}>Log in</h2>
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          type="email"
          required
          style={inputStyle}
        />
        <input
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          type="password"
          required
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            background: "#5F43B2",
            opacity: loading ? 0.7 : 1,
            marginBottom: "1.5rem",
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
        <div style={{ textAlign: "center", fontSize: "15px", color: "#888" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#5F43B2", textDecoration: "underline" }}>
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "18px",
  border: "1px solid #C9B6F7",
  borderRadius: "7px",
  background: "#F6F3FA",
  fontSize: "16px",
  outline: "none",
  transition: "border 0.2s",
};

const buttonStyle = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "7px",
  color: "#fff",
  fontWeight: 600,
  fontSize: "16px",
  cursor: "pointer",
  background: "#5F43B2",
  transition: "background 0.2s",
};

export default Login;
