import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: "2px solid #ece4fa" }}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography component={Link} to="/" color="primary" fontWeight={900} variant="h5" sx={{ textDecoration: "none" }}>
          JobPortal
        </Typography>
        <Box>
          <Button component={Link} to="/" color="primary">Home</Button>
          {token ? (
            <>
              <Button component={Link} to="/profile" color="primary">Profile</Button>
              <Button onClick={handleLogout} color="primary">Logout</Button>
            </>
          ) : (
            <>
              <Button component={Link} to="/login" color="primary">Login</Button>
              <Button component={Link} to="/signup" color="primary" variant="contained" sx={{ ml: 1 }}>Signup</Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
