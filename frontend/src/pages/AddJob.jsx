import React, { useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Box, Alert } from "@mui/material";
import { createJob } from "../services/jobsApi.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthRequired from "../components/AuthRequired/AuthRequired.jsx";

// Phase 2B: transport only — routed through the centralized jobsApi, so
// this now correctly sends the Authorization header POST /api/jobs
// requires (BACKEND_API_CONTRACT.md §5) and surfaces the backend's real
// error message instead of a blind "Failed to add job" for every
// failure.
//
// Phase 2E: this endpoint requires authentication
// (BACKEND_API_CONTRACT.md §5) but the page previously let an
// unauthenticated visitor fill out the whole form only to have it fail
// with a 401 on submit. It now shows the shared AuthRequired fallback
// up front instead — the backend remains the real authorization
// boundary either way; this is purely a "don't invite a request that's
// guaranteed to fail" UX fix.
//
// Later fix: the form previously submitted a flat `location` string and
// an unrelated `type` field — the backend's Job schema expects a
// structured `location.raw` and a `job_type` field, and its
// UPSERT_CONTENT_FIELDS whitelist (jobService.js) silently dropped
// `type` entirely, so submissions reliably 400'd. `job_type` now matches
// the whitelist key, and `location` is built as `{ raw: locationInput }`
// on submit — the only subfield the schema requires
// (display_name/city/state/country stay unset; there's no UI collecting
// those separately). `source` needs no change here — createManualJob
// (jobService.js) already auto-fills it server-side.
export default function AddJob() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ title: "", company: "", location: "", job_type: "", description: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
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
