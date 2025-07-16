import React, { useState } from "react";
import { Container, Card, CardContent, TextField, Button, Typography } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok) {
      alert("Login successful");
      navigate("/");
    } else {
      alert(data.msg || "Login failed");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Login
          </Typography>
          <form onSubmit={handleSubmit}>
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
              Login
            </Button>
            <Typography sx={{ mt: 2 }}>
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </Typography>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
