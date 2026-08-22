import React, { useState } from "react";
import { Container, Card, CardContent, TextField, Button, Typography, Alert } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { signup as signupRequest } from "../services/authApi.js";

// Phase 2F: UI/UX polish only — the request itself is unchanged
// (`signupRequest(form.name, form.email, form.password)`, then a
// navigation to /login on success). A blocking `alert()` on failure was
// replaced with an inline, dismissable-by-retry `Alert` (consistent with
// Login.jsx's own error presentation and with Profile.jsx's Phase 2E
// pattern), and the submit button now shows a real loading/disabled
// state so a double-click can't fire two signup requests.
export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      await signupRequest(form.name, form.email, form.password);
      navigate("/login");
    } catch (err) {
      setError(err.message || "Signup failed");
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Sign Up
          </Typography>
          {error && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <TextField
              name="name"
              value={form.name}
              onChange={handleChange}
              label="Name"
              autoComplete="name"
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
              autoComplete="email"
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
              autoComplete="new-password"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
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
