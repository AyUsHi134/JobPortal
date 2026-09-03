import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useAuth } from "../../hooks/useAuth.js";
import "./Navbar.scss";

// Phase 2F established the underlying mechanics — a real <button>
// hamburger toggle (aria-expanded/aria-controls, closes on navigation)
// and NavLink-based active-route indication — and both are kept exactly
// as they were; per this phase's own instruction not to replace the
// hamburger implementation without a real reason to. No authentication
// logic changed here either: `logout` still comes straight from
// AuthContext and is called exactly the same way.
//
// Phase 2G-1: reworked the link SET and its grouping to match this
// phase's exact logged-out/logged-in navigation spec (a single,
// still-one-list `<ul>` — no duplicated desktop/mobile DOM — with the
// auth-action items marked so desktop CSS can push them to the right
// edge while the primary links sit left, after the brand; see
// Navbar.scss's `@include tablet-down` section for how this collapses
// into one plain vertical list on mobile, exactly as it already did):
//   logged out: Home, Find Jobs, About, Contact | Login, Sign Up
//   logged in:  Home, Find Jobs, About | Profile
// "Contact" is intentionally omitted once logged in — this matches the
// task's own explicit ordering, not an oversight.
//
// Profile is a dropdown/menu trigger rather than a direct link — it
// toggles a small menu (View Profile / Saved Jobs / Logout) instead of
// navigating on its own click; View Profile and Logout reuse the exact
// same /profile route and logout()/navigate("/login") the old standalone
// Profile link and Logout button used, just relocated. The standalone
// top-level "Saved Jobs" item that used to sit before "About" is gone —
// Saved Jobs now has exactly one navbar entry, inside this dropdown.
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  // Selecting a Profile-menu option (View Profile / Saved Jobs) closes
  // both the dropdown itself and, on mobile, the hamburger panel it sits
  // inside — the Profile trigger's own click does neither, so opening
  // the dropdown on mobile doesn't instantly collapse the panel around it.
  const closeProfileMenu = () => setProfileMenuOpen(false);
  const handleProfileMenuSelect = () => {
    closeProfileMenu();
    closeMobileMenu();
  };

  // Closes the Profile dropdown on any click outside it. Only attached
  // while the menu is actually open.
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

        {/* The first item in this group is where desktop CSS pushes the
            "authentication actions" cluster to the bar's right edge
            (Navbar.scss's `.navbar__links li.navbar__auth-start`) — the
            primary links above sit left, right after the brand. */}
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
            <li className="navbar__auth-start"><NavLink to="/login" className={navLinkClass} onClick={closeMobileMenu}>Login</NavLink></li>
            <li><NavLink to="/signup" className={({ isActive }) => `signup-btn${isActive ? " active" : ""}`} onClick={closeMobileMenu}>Sign Up</NavLink></li>
          </>
        )}
      </ul>
    </nav>
  );
}
