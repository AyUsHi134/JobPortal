import React from "react";
import { Box, Typography, Grid } from "@mui/material";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import PublicIcon from "@mui/icons-material/Public";

const features = [
  { icon: <WorkOutlineIcon color="primary" sx={{ fontSize: 40 }} />, title: "Startup Focus", desc: "Freshest startup and tech jobs." },
  { icon: <VerifiedUserIcon color="primary" sx={{ fontSize: 40 }} />, title: "Verified Listings", desc: "Genuine, hand-checked companies." },
  { icon: <PublicIcon color="primary" sx={{ fontSize: 40 }} />, title: "Remote First", desc: "Fully-remote jobs available worldwide." }
];

export default function FeaturesSection() {
  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Why Choose Us?
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {features.map((f, i) => (
          <Grid item xs={12} sm={4} key={i}>
            <Box>{f.icon}</Box>
            <Typography variant="h6" fontWeight={700}>{f.title}</Typography>
            <Typography color="text.secondary">{f.desc}</Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
