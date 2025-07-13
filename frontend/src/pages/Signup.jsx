import React, { useState } from "react";
import { Container, TextField, Button, Typography, Box, Paper } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Signup successful! Please login.");
        navigate("/login");
      } else {
        alert(data.msg || "Signup failed");
      }
    } catch {
      alert("Signup failed");
    }
    setLoading(false);
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" color="primary" fontWeight={700} align="center" gutterBottom>
          Sign Up
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth margin="normal" label="Name" name="name"
            value={form.name} onChange={handleChange} required
          />
          <TextField
            fullWidth margin="normal" label="Email" name="email" type="email"
            value={form.email} onChange={handleChange} required
          />
          <TextField
            fullWidth margin="normal" label="Password" name="password" type="password"
            value={form.password} onChange={handleChange} required
          />
          <Button
            variant="contained" color="primary" type="submit"
            fullWidth sx={{ mt: 2, borderRadius: 2 }}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Account"}
          </Button>
          <Box mt={2} textAlign="center">
            Already have an account? <Link to="/login">Login</Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
