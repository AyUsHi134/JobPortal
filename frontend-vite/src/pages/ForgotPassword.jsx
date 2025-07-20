import React, { useState } from "react";
import { Container, Card, CardContent, TextField, Button, Typography } from "@mui/material";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Forgot Password
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              label="Email"
              type="email"
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Send Reset Link
            </Button>
          </form>
          {sent && <Typography sx={{ mt: 2 }} color="success.main">If the email exists, a reset link has been sent.</Typography>}
        </CardContent>
      </Card>
    </Container>
  );
}
