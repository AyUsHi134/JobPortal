import { Box, Typography } from "@mui/material";

export default function HeroSection() {
  return (
    <Box
      sx={{
        bgcolor: "#ebe4fa",
        py: 6,
        textAlign: "center",
        borderRadius: "0 0 32px 32px",
        mb: 2,
      }}
    >
      <Typography
        variant="h2"
        fontWeight={900}
        color="primary"
        sx={{ mb: 2, fontSize: { xs: "2rem", md: "3.3rem" } }}
      >
        Your Next Role? Already Here.
      </Typography>
      <Typography color="text.secondary" fontSize="1.35rem">
        New jobs, hot startups, and future-ready openings await.

x1
      </Typography>
    </Box>
  );
}
