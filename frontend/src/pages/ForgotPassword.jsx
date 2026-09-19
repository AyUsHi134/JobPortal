import React from "react";
import { Link } from "react-router-dom";
import { Container, Card, CardContent, Typography, Button } from "@mui/material";

// No reset endpoint exists
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
