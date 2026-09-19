import React, { useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Box, Alert } from "@mui/material";
import { createJob } from "../services/jobsApi.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthRequired from "../components/AuthRequired/AuthRequired.jsx";

// Uses jobsApi, requires auth
export default function AddJob() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ title: "", company: "", location: "", job_type: "", description: "" });
  const [status, setStatus] = useState("idle"); // Form status values
  const [message, setMessage] = useState("");

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      await createJob({ ...form, location: { raw: form.location } });
      setStatus("success");
      setForm({ title: "", company: "", location: "", job_type: "", description: "" });
    } catch (err) {
      setMessage(err.message || "Failed to add job");
      setStatus("error");
    }
  };

  if (!isAuthenticated) {
    return <AuthRequired message="Log in to post a job." />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Add New Job
          </Typography>

          {status === "success" && (
            <Alert severity="success" role="status" sx={{ mb: 2 }}>Job added!</Alert>
          )}
          {status === "error" && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>{message}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField fullWidth required label="Job Title" name="title" value={form.title} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Company" name="company" value={form.company} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Location" name="location" value={form.location} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Type" name="job_type" value={form.job_type} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Description" name="description" value={form.description} onChange={handleChange} multiline minRows={3} sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={status === "submitting"}>
              {status === "submitting" ? "Adding..." : "Add Job"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
