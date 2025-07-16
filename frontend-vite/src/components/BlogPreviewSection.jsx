import React from "react";
import { Box, Typography, Card, CardContent, Button, Grid } from "@mui/material";

const blogs = [
  { title: "Ace Your Remote Interview", summary: "Proven tips to land remote jobs faster.", link: "#" },
  { title: "2024's Top Tech Skills", summary: "Upgrade your profile and get noticed.", link: "#" },
  { title: "How to Build a Startup Resume", summary: "Craft a winning application.", link: "#" },
];

export default function BlogPreviewSection() {
  return (
    <Box sx={{ py: 5, textAlign: "center" }}>
      <Typography variant="h5" fontWeight={800} color="primary" mb={2}>
        Career Advice
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        {blogs.map((b, i) => (
          <Grid item xs={12} sm={4} key={i}>
            <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
              <CardContent>
                <Typography fontWeight={700} gutterBottom>{b.title}</Typography>
                <Typography color="text.secondary">{b.summary}</Typography>
                <Button href={b.link} variant="text" sx={{ mt: 2 }}>
                  Read More
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
