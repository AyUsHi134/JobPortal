import React from "react";
import { Box, Typography, Avatar, Grid } from "@mui/material";

const companies = [
  { name: "Stripe", logo: "https://logo.clearbit.com/stripe.com" },
  { name: "Notion", logo: "https://logo.clearbit.com/notion.so" },
  { name: "Figma", logo: "https://logo.clearbit.com/figma.com" },
  { name: "Zapier", logo: "https://logo.clearbit.com/zapier.com" }
];

export default function CompaniesSection() {
  return (
    <Box sx={{ py: 5, textAlign: "center" }}>
      <Typography variant="h5" fontWeight={800} color="primary" mb={2}>
        Top Companies Hiring
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        {companies.map((c, i) => (
          <Grid item key={i}>
            <Avatar src={c.logo} alt={c.name} sx={{ width: 70, height: 70, margin: "0 auto" }} />
            <Typography fontWeight={600}>{c.name}</Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
