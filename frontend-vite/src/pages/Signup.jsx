import React, { useState } from "react";
import { Container, Card, CardContent, TextField, Button, Typography } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    const res = await fetch("http://localhost:5000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok) {
      navigate("/login");
    } else {
      alert(data.msg || "Signup failed");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Sign Up
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              name="name"
              value={form.name}
              onChange={handleChange}
              label="Name"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              name="email"
              value={form.email}
              onChange={handleChange}
              label="Email"
              type="email"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              name="password"
              value={form.password}
              onChange={handleChange}
              label="Password"
              type="password"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Create Account
            </Button>
            <Typography sx={{ mt: 2 }}>
              Already have an account? <Link to="/login">Log in</Link>
            </Typography>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
