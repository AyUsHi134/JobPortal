import React from "react";
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, Menu, MenuItem,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

export default function Navbar() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleMenu = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: "2px solid #ece4fa" }}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography component={Link} to="/" color="primary" fontWeight={900} variant="h5" sx={{ textDecoration: "none" }}>
          JobPortal
        </Typography>
        <Box>
          <Button component={Link} to="/" color="primary" startIcon={<HomeIcon />}>
            HOME
          </Button>
          {!token ? (
            <>
              <Button component={Link} to="/login" color="primary" startIcon={<LoginIcon />}>
                LOGIN
              </Button>
              <Button component={Link} to="/signup" variant="contained" color="primary" startIcon={<PersonAddIcon />} sx={{ ml: 2, fontWeight: 700 }}>
                SIGNUP
              </Button>
            </>
          ) : (
            <>
              <IconButton onClick={handleMenu} sx={{ ml: 2 }}>
                <Avatar>
                  <PersonIcon />
                </Avatar>
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                <MenuItem component={Link} to="/profile" onClick={handleClose}>Profile</MenuItem>
                <MenuItem onClick={() => { handleClose(); handleLogout(); }}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
