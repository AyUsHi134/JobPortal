import React from "react";
import { Box, Typography } from "@mui/material";

// Phase 2G-3: moved off the hardcoded purple hex onto the shared MUI
// theme's `primary.main` (green since Phase 2G-1) so this file never
// needs its own hand-kept-in-sync color value, and simplified the
// copyright line — the old "💜"/tech-stack callout was a leftover from
// the pre-redesign purple theme, not a product claim.
export default function Footer() {
  return (
    <Box sx={{ bgcolor: "primary.main", color: "#fff", py: 4, textAlign: "center", mt: 6 }}>
      <Typography fontWeight={600}>&copy; {new Date().getFullYear()} JobPortal. All rights reserved.</Typography>
    </Box>
  );
}
