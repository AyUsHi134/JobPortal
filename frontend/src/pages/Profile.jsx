import React, { useEffect, useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Avatar, Alert, Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useAuth } from "../hooks/useAuth.js";
import { getProfile, updateProfile } from "../services/userApi.js";
import AuthRequired from "../components/AuthRequired/AuthRequired.jsx";
import { buildProfileUpdates } from "../utils/profileUi.js";

// Real profile load and save
export default function Profile() {
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });

  const [saveState, setSaveState] = useState("idle"); // Form status values
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
        // Normalized safe message only
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
      // Covers real failure modes
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
