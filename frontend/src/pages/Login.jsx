import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styled from "styled-components";
import Button from "../components/Button";

const Wrapper = styled.div`
  min-height: 100vh;
  background: linear-gradient(120deg, #ece6f7 0%, #d1c4e9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
`;
const Card = styled.form`
  background: #fff;
  padding: 2.6rem 2.1rem 2rem 2.1rem;
  border-radius: 14px;
  box-shadow: 0 2px 28px rgba(95,67,178,0.12);
  width: 350px;
  max-width: 96vw;
  display: flex;
  flex-direction: column;
`;
const Input = styled.input`
  margin-bottom: 17px;
  padding: 13px 12px;
  border-radius: 7px;
  border: 1.5px solid #b6a3e4;
  background: #f6f3fa;
  font-size: 16px;
  outline: none;
`;

export default function Login() {
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
        // Store user token if returned: localStorage.setItem("token", data.token);
        alert("Login successful!");
        navigate("/profile");
      } else {
        alert(data.msg || "Login failed");
      }
    } catch (err) {
      alert("Login failed");
    }
    setLoading(false);
  };

  return (
    <Wrapper>
      <Card onSubmit={handleSubmit}>
        <h2 style={{color: "#5f43b2", fontWeight: "800", fontSize: "1.7rem", marginBottom: "2.1rem"}}>Login</h2>
        <Input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          type="email"
          required
        />
        <Input
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          type="password"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
        <div style={{ textAlign: "center", fontSize: "15px", color: "#888", marginTop: "18px" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#7b42f6", textDecoration: "underline" }}>Sign up</Link>
        </div>
      </Card>
    </Wrapper>
  );
}
