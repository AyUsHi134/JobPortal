import React, { useEffect, useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Avatar, Alert, Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useAuth } from "../hooks/useAuth.js";
import { getProfile, updateProfile } from "../services/userApi.js";
import AuthRequired from "../components/AuthRequired/AuthRequired.jsx";
import { buildProfileUpdates } from "../utils/profileUi.js";

// Phase 2E: previously 100% hardcoded mock data that never called the
// backend at all (FRONTEND_AUDIT.md §2/§10 — the exact gap this phase
// closes). Now loads the real authenticated user via
// GET /api/user/profile and submits edits via PUT /api/user/profile
// (BACKEND_API_CONTRACT.md §7), both through the centralized userApi
// service — identity is carried entirely by the JWT the apiClient
// attaches; no user id is ever read from a URL/body field, so this page
// can only ever load/edit the logged-in user's own account. The old
// mock's disabled "Email" field and its non-functional file-picker for a
// document attachment are removed: the real contract accepts an email
// change (both `name`/`email` are editable per §7), and there is no
// attachment-upload endpoint anywhere in the backend contract to wire
// that control to — a control with no possible effect would just be a
// second, still-fake mock, not a fix.
export default function Profile() {
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });

  const [saveState, setSaveState] = useState("idle"); // idle | saving | success | error
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setStatus("loading");

    getProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm({ name: data.name || "", email: data.email || "" });
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        // A normalized, safe message only (services/api.js) — never a
        // raw Axios error or backend internal detail, regardless of
        // whether this was a 401/404/500/network failure.
        setLoadError(err.message || "Could not load your profile right now.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveState("saving");
    setSaveError("");

    const updates = buildProfileUpdates(profile, form);

    if (Object.keys(updates).length === 0) {
      setSaveState("idle");
      return;
    }

    try {
      const updated = await updateProfile(updates);
      setProfile(updated);
      setForm({ name: updated.name || "", email: updated.email || "" });
      setSaveState("success");
    } catch (err) {
      // Covers BACKEND_API_CONTRACT.md §7's real failure modes: 400
      // "Email already in use.", 401 (session expired mid-edit — the
      // apiClient interceptor has already cleared stale auth by the time
      // this catch runs), 404 "User not found" (edge case), 500. The
      // normalized message is always safe to show directly.
      setSaveError(err.message || "Could not update your profile right now.");
      setSaveState("error");
    }
  };

  if (!isAuthenticated) {
    return <AuthRequired message="Log in to view your profile." />;
  }

  if (status === "loading") {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 }, textAlign: "center" }}>
        <Typography color="text.secondary" role="status" aria-live="polite">Loading your profile...</Typography>
      </Container>
    );
  }

  if (status === "error") {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
        <Alert severity="error" role="alert">{loadError}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Card>
        <CardContent>
          <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 2 }}>
            <PersonIcon sx={{ fontSize: 42 }} />
          </Avatar>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom align="center">
            My Profile
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
              fullWidth
              sx={{ mb: 2 }}
            />

            {saveState === "error" && (
              <Alert severity="error" role="alert" sx={{ mb: 2 }}>{saveError}</Alert>
            )}
            {saveState === "success" && (
              <Alert severity="success" role="status" sx={{ mb: 2 }}>Profile updated.</Alert>
            )}

            <Button type="submit" variant="contained" color="primary" fullWidth disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
