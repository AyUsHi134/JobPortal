import React from "react";
import { Box, Typography, Grid, Button } from "@mui/material";

const categories = [
  { label: "Frontend", count: 20 },
  { label: "Backend", count: 18 },
  { label: "Data Science", count: 12 },
  { label: "AI/ML", count: 8 },
  { label: "DevOps", count: 7 },
  { label: "UI/UX", count: 10 },
];

export default function JobCategories() {
  return (
    <Box sx={{ bgcolor: "#ece4fa", py: 6, mt: 4 }}>
      <Typography variant="h5" fontWeight={700} color="primary" align="center" sx={{ mb: 3 }}>
        Job Categories
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        {categories.map((cat) => (
          <Grid item xs={12} sm={6} md={4} key={cat.label}>
            <Box sx={{ p: 3, borderRadius: 2, boxShadow: 1, textAlign: "center", bgcolor: "#fff" }}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>
                {cat.label}
              </Typography>
              <Typography color="text.secondary">{cat.count} jobs</Typography>
              <Button
                variant="outlined"
                color="primary"
                sx={{ mt: 2, fontWeight: 700 }}
                // onClick={() => {/* handle category click */}}
              >
                Explore
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
