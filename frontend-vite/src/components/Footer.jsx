import React from "react";
import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box sx={{ bgcolor: "#7046d3", color: "#fff", py: 4, textAlign: "center", mt: 6 }}>
      <Typography fontWeight={600}>&copy; {new Date().getFullYear()} JobPortal | Built with MERN, MUI, SCSS 💜</Typography>
    </Box>
  );
}
