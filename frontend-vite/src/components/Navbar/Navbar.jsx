import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js"; 
import "./Navbar.scss";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <Link to="/">JobPortal</Link>
      </div>
      <ul className="navbar__links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/jobs">Find a Job</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/contact">Contact</Link></li>

        {user ? (
          <>
            <li><Link to="/profile">Profile</Link></li>
            <li><Link to="/saved-jobs">Saved Jobs</Link></li>
            <li><button onClick={handleLogout} className="logout-btn">Logout</button></li>
          </>
        ) : (
          <>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup" className="signup-btn">Signup</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
}
