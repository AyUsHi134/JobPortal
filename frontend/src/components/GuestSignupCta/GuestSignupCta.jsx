import { Box, Typography, Button } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

// Guest limit signup panel
export default function GuestSignupCta() {
  const location = useLocation();
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
      {/* Force white hover text */}
      <Button
        component={Link}
        to="/signup"
        state={{ from: location.pathname + location.search }}
        variant="contained"
        color="primary"
        sx={{ fontWeight: 700, "&:hover": { color: "#fff !important" } }}
      >
        Sign Up
      </Button>
    </Box>
  );
}
