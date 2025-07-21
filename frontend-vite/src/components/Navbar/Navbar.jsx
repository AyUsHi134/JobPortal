import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.scss";

export default function Navbar() {
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
        <li><Link to="/login">Login</Link></li>
        <li><Link to="/signup" className="signup-btn">Signup</Link></li>
      </ul>
    </nav>
  );
}
