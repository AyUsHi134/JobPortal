import React from "react";
import { Box, Container, Typography, Button, TextField } from "@mui/material";

export default function NewsletterSection() {
  return (
    <Box sx={{ bgcolor: "#ece4fa", py: 6, mt: 7 }}>
      <Container maxWidth="sm">
        <Typography variant="h6" fontWeight={700} align="center" sx={{ mb: 2 }}>
          Get new jobs in your inbox!
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <TextField variant="outlined" placeholder="Your email" size="small" sx={{ bgcolor: "#fff", borderRadius: 1 }} />
          <Button variant="contained" color="primary">Subscribe</Button>
        </Box>
      </Container>
    </Box>
  );
}
