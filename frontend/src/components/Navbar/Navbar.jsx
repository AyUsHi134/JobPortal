import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useAuth } from "../../hooks/useAuth.js";
import "./Navbar.scss";

// Navbar link groups and dropdown
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authRedirectState = { from: location.pathname + location.search };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const handleLogout = () => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
    logout();
    navigate("/login");
  };

  const closeMobileMenu = () => setMobileOpen(false);

  // Selecting menu option closes menus
  const closeProfileMenu = () => setProfileMenuOpen(false);
  const handleProfileMenuSelect = () => {
    closeProfileMenu();
    closeMobileMenu();
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  const navLinkClass = ({ isActive }) => (isActive ? "active" : undefined);

  return (
    <nav className="navbar">
      <div className="navbar__bar">
        <div className="navbar__brand">
          <Link to="/" onClick={closeMobileMenu}>JobPortal</Link>
        </div>

        <button
          type="button"
          className="navbar__toggle"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="navbar-links"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <span className="navbar__toggle-bar" />
          <span className="navbar__toggle-bar" />
          <span className="navbar__toggle-bar" />
        </button>
      </div>

      <ul id="navbar-links" className={`navbar__links${mobileOpen ? " navbar__links--open" : ""}`}>
        <li><NavLink to="/" end className={navLinkClass} onClick={closeMobileMenu}>Home</NavLink></li>
        <li><NavLink to="/jobs" className={navLinkClass} onClick={closeMobileMenu}>Find Jobs</NavLink></li>

        <li><NavLink to="/about" className={navLinkClass} onClick={closeMobileMenu}>About</NavLink></li>

        {!user && (
          <li><NavLink to="/contact" className={navLinkClass} onClick={closeMobileMenu}>Contact</NavLink></li>
        )}

        {/* Auth cluster starts here */}
        {user ? (
          <li className="navbar__auth-start navbar__profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="navbar__profile-trigger"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((prev) => !prev)}
            >
              <PersonOutlineIcon />
              Profile
            </button>
            <ul role="menu" className={`navbar__profile-dropdown${profileMenuOpen ? " navbar__profile-dropdown--open" : ""}`}>
              <li role="none">
                <NavLink role="menuitem" to="/profile" className={navLinkClass} onClick={handleProfileMenuSelect}>View Profile</NavLink>
              </li>
              <li role="none">
                <NavLink role="menuitem" to="/saved-jobs" className={navLinkClass} onClick={handleProfileMenuSelect}>Saved Jobs</NavLink>
              </li>
              <li role="none">
                <NavLink role="menuitem" to="/add-job" className={navLinkClass} onClick={handleProfileMenuSelect}>Post a Job</NavLink>
              </li>
              <li role="none">
                <button role="menuitem" type="button" onClick={handleLogout} className="logout-btn">Logout</button>
              </li>
            </ul>
          </li>
        ) : (
          <>
            <li className="navbar__auth-start"><NavLink to="/login" state={authRedirectState} className={navLinkClass} onClick={closeMobileMenu}>Login</NavLink></li>
            <li><NavLink to="/signup" state={authRedirectState} className={({ isActive }) => `signup-btn${isActive ? " active" : ""}`} onClick={closeMobileMenu}>Sign Up</NavLink></li>
          </>
        )}
      </ul>
    </nav>
  );
}
