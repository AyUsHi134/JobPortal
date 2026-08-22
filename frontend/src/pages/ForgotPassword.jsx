import React from "react";
import { Link } from "react-router-dom";
import { Container, Card, CardContent, Typography, Button } from "@mui/material";

// Phase 2G-5 audit finding (see PHASE_2G5_REPORT.md for the full trace):
// this page previously flipped a local "done" flag on every submit,
// unconditionally — no network request was ever made, `services/authApi.js`
// has never
// exported a forgot-password function, and `backend/routes/auth.js`
// registers only `/signup` and `/login` (confirmed by direct source
// read, not assumption). There is no reset-token field on the User model
// and no email-provider dependency anywhere in backend/package.json —
// self-service password reset has never been implemented on either side
// of this app. The previous "If the email exists, a reset link has been
// sent." message was therefore always false: no email was ever sent to
// anyone, for any input, because no code path ever attempted to send
// one.
//
// Per this phase's explicit instructions — do not invent a missing
// backend endpoint or email-provider architecture, and do not keep a
// misleading "email sent" message when no email can actually be sent —
// this page now states the real limitation honestly instead of
// simulating a request that never happened. No form, no fake submit
// state, and no network call: there is nothing real for either to do
// yet. This can be replaced with a real request-a-reset form once a
// genuine backend endpoint (token generation/expiry, storage, and an
// actual email-sending integration) exists.
export default function ForgotPassword() {
  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Forgot Password
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Self-service password reset isn't available yet — this account recovery
            feature hasn't been built. We can't send a reset email because there is
            no email-sending capability configured for this app.
          </Typography>
          <Typography sx={{ mb: 3 }} color="text.secondary">
            If you remember your password, you can log in directly. If you no longer
            have access to this account, please contact whoever manages this
            JobPortal deployment for help.
          </Typography>
          <Button component={Link} to="/login" variant="contained" color="primary" fullWidth>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}
