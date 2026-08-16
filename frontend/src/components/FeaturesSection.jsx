import React from "react";
import { Container, Typography, Grid, Box } from "@mui/material";

export default function FeaturesSection() {
  return (
    <div className="features-section">
      <Container>
        <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 3 }}>
          Why Choose Us?
        </Typography>
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} sm={4}>
            <Box className="feature-card">
              <Typography fontWeight={700}>Startup Focus</Typography>
              <Typography color="text.secondary" variant="body2">
                Freshest startup and tech jobs daily.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box className="feature-card">
              <Typography fontWeight={700}>Verified Listings</Typography>
              <Typography color="text.secondary" variant="body2">
                Hand-checked, real companies.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box className="feature-card">
              <Typography fontWeight={700}>Remote First</Typography>
              <Typography color="text.secondary" variant="body2">
                Fully-remote & on-site jobs.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
