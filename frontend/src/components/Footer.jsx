import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import "./Footer.scss";

// Isolated on purpose, per this phase's explicit instruction not to invent
// real destinations — "#" is a safe no-op placeholder, never a fabricated
// real URL. Swap these two values for the project's real GitHub/LinkedIn
// URLs whenever they're known; nothing else in this file needs to change.
const SOCIAL_LINKS = {
  github: "#",
  linkedin: "#",
};

// Real, already-registered App.jsx routes only, same as Navbar.jsx's own
// nav items.
const QUICK_LINKS = [
  { label: "Home", to: "/" },
  { label: "Find Jobs", to: "/jobs" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  // null | "unavailable" — no other value exists, since no real request
  // is ever attempted (see handleNewsletterSubmit below).
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  // UI-only for now: no backend endpoint for job-alert subscriptions
  // exists yet, so this deliberately makes no network call and never
  // claims success. When a real endpoint exists, the one change needed
  // here is awaiting a new service function and setting newsletterStatus
  // from its real result — nothing else about this form's structure needs
  // to change for that to slot in cleanly.
  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    setNewsletterStatus("unavailable");
  };

  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__grid">
          <div className="footer__col">
            <p className="footer__brand-name">JobPortal</p>
            <p className="footer__tagline">
              One place to search jobs aggregated from multiple sources — search, filter, and apply without the
              tab-hopping.
            </p>
          </div>

          <div className="footer__col">
            <p className="footer__heading">Quick Links</p>
            <ul className="footer__links">
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <RouterLink to={link.to}>{link.label}</RouterLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col">
            <p className="footer__heading">Never miss a job</p>
            <p className="footer__newsletter-text">
              Get new listings that match your interests, sent straight to your inbox.
            </p>
            <form className="footer__newsletter-form" onSubmit={handleNewsletterSubmit} noValidate>
              <input
                type="email"
                required
                className="footer__input"
                placeholder="you@example.com"
                aria-label="Email address for job alerts"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button type="submit" className="footer__subscribe-btn">
                Subscribe
                <ArrowForwardIcon />
              </button>
            </form>
            {newsletterStatus === "unavailable" && (
              <p className="footer__newsletter-status" role="status">
                Job alerts aren't available yet — check back soon.
              </p>
            )}
          </div>

          <div className="footer__col">
            <p className="footer__heading">Follow Us</p>
            <div className="footer__social">
              <a
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="JobPortal on GitHub"
                className="footer__social-link"
              >
                <GitHubIcon fontSize="small" />
              </a>
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="JobPortal on LinkedIn"
                className="footer__social-link"
              >
                <LinkedInIcon fontSize="small" />
              </a>
            </div>
          </div>
        </div>

        <p className="footer__bottom">&copy; {new Date().getFullYear()} JobPortal. All rights reserved.</p>
      </div>
    </footer>
  );
}
