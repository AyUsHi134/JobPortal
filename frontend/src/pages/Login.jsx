import React, { useState } from "react";
import { Container, TextField, Button, Typography, Box, Paper } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        alert("Login successful!");
        navigate("/");
      } else {
        alert(data.msg || "Login failed");
      }
    } catch {
      alert("Login failed");
    }
    setLoading(false);
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" color="primary" fontWeight={700} align="center" gutterBottom>
          Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
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
            {loading ? "Logging in..." : "Login"}
          </Button>
          <Box mt={2} textAlign="center">
            New user? <Link to="/signup">Sign Up</Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
