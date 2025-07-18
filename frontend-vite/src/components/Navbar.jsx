import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import HomeIcon from '@mui/icons-material/Home';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

export default function Navbar() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: "2px solid #ece4fa" }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography
          component={Link}
          to="/"
          color="primary"
          fontWeight={900}
          variant="h5"
          sx={{ textDecoration: "none" }}
        >
          JobPortal
        </Typography>
        <Box>
          <Button
            component={Link}
            to="/"
            color="primary"
            startIcon={<HomeIcon />}
          >
            Home
          </Button>
          {token ? (
            <>
              <Button
                component={Link}
                to="/profile"
                color="primary"
                startIcon={<PersonIcon />}
              >
                Profile
              </Button>
              <Button
                onClick={handleLogout}
                color="primary"
                startIcon={<LogoutIcon />}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                component={Link}
                to="/login"
                color="primary"
                startIcon={<LoginIcon />}
              >
                Login
              </Button>
              <Button
                component={Link}
                to="/signup"
                variant="contained"
                color="primary"
                startIcon={<PersonAddIcon />}
                sx={{ ml: 2, fontWeight: 700 }}
              >
                Signup
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
