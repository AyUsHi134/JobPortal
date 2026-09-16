import { Box, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";

// The "you've hit the guest job-view limit, sign up to keep browsing"
// panel — originally Home.jsx's own guest signup CTA (Phase 2G-3),
// extracted here so FindJob.jsx can show the exact same treatment once
// the backend reports `guestLimitReached` (backend/controllers/jobs.js,
// surfaced via hooks/useGuestJobLimit.js), instead of duplicating the
// markup.
export default function GuestSignupCta() {
  return (
    <Box
      sx={{
        mt: 4,
        mx: "auto",
        maxWidth: 480,
        textAlign: "center",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 3,
      }}
    >
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>
        Want to explore more jobs?
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
        Create a free account to keep browsing — and save the jobs you like along the way.
      </Typography>
      {/* This Button renders as a real <a> (component={Link}), so it also
          matches main.scss's global `a:hover { color: $primary-hover }`
          rule — and $primary-hover is the exact same hex as this button's
          own MUI hover background (theme.palette.primary.dark), since that
          global rule has higher CSS specificity (element+pseudo-class)
          than MUI's single generated class for text color, it was winning
          on hover and making the white "Sign Up" text repaint the same
          color as the background — invisible. Forcing the hover text
          color back to white here (scoped to this one button only) fixes
          exactly that. */}
      <Button
        component={Link}
        to="/signup"
        variant="contained"
        color="primary"
        sx={{ fontWeight: 700, "&:hover": { color: "#fff !important" } }}
      >
        Sign Up
      </Button>
    </Box>
  );
}
