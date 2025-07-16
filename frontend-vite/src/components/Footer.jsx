import React from "react";
import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box sx={{ py: 4, textAlign: "center", color: "#888" }}>
      <Typography>
        © {new Date().getFullYear()} JobPortal. Made with ❤️ for startup talent.
      </Typography>
    </Box>
  );
}
