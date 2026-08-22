import React, { useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Box, Alert } from "@mui/material";
import { createJob } from "../services/jobsApi.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthRequired from "../components/AuthRequired/AuthRequired.jsx";

// Phase 2B: transport only — routed through the centralized jobsApi, so
// this now correctly sends the Authorization header POST /api/jobs
// requires (BACKEND_API_CONTRACT.md §5) and surfaces the backend's real
// error message instead of a blind "Failed to add job" for every
// failure. The form's fields are intentionally NOT changed here: the
// backend's normalized schema expects a structured `location` object and
// a `job_type` field, but this form still submits a flat `location`
// string and an unrelated `type` field (silently dropped by the
// backend's own field whitelist), so a real submission will very likely
// still fail with a 400 today. Reworking the form itself is explicitly
// deferred to Phase 2F (FRONTEND_AUDIT.md §18) — see PHASE_2B_REPORT.md
// for the full reasoning.
//
// Phase 2E: this endpoint requires authentication
// (BACKEND_API_CONTRACT.md §5) but the page previously let an
// unauthenticated visitor fill out the whole form only to have it fail
// with a 401 on submit. It now shows the shared AuthRequired fallback
// up front instead — the backend remains the real authorization
// boundary either way; this is purely a "don't invite a request that's
// guaranteed to fail" UX fix.
export default function AddJob() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ title: "", company: "", location: "", type: "", description: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [message, setMessage] = useState("");

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      await createJob(form);
      setStatus("success");
      setForm({ title: "", company: "", location: "", type: "", description: "" });
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

          {/* Phase 2F: an honest, visible note rather than a silent trap —
              this form still submits a flat `location` string and an
              unrelated `type` field (BACKEND_API_CONTRACT.md §5 expects a
              structured `location` object and has no `type` field at
              all), so a real submission will likely be rejected with a
              400 today. Reworking the form's data contract is out of this
              polish-only phase's scope (see PHASE_2F_REPORT.md §10); this
              note exists so a user isn't left guessing why submission
              failed. */}
          <Alert severity="info" sx={{ mb: 2 }}>
            Job posting is still being finalized against the current data model — submitting may not succeed yet.
          </Alert>

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
            <TextField fullWidth required label="Type" name="type" value={form.type} onChange={handleChange} sx={{ mb: 2 }} />
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
