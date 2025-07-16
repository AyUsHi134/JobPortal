import React from "react";
import { Card, CardContent, Typography, TextField, Button, Box } from "@mui/material";

export default function NewsletterSection() {
  return (
    <Box sx={{ my: 6, display: "flex", justifyContent: "center" }}>
      <Card sx={{ width: 400 }}>
        <CardContent>
          <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>
            Subscribe to Our Newsletter
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Get the latest jobs and career tips straight to your inbox!
          </Typography>
          <Box component="form" sx={{ display: "flex", mt: 2 }}>
            <TextField
              type="email"
              label="Your email"
              variant="outlined"
              size="small"
              sx={{ flex: 1, mr: 1 }}
            />
            <Button type="submit" variant="contained" color="primary">
              Subscribe
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
