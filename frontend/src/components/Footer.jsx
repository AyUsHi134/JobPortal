import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import "./Footer.scss";

// Real repository and profile URLs
const SOCIAL_LINKS = {
  github: "https://github.com/AyUsHi134/JobPortal",
  linkedin: "https://www.linkedin.com/in/ayushi-singh-dev/",
};

// Real registered routes only
const QUICK_LINKS = [
  { label: "Home", to: "/" },
  { label: "Find Jobs", to: "/jobs" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  // null or unavailable
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  // UI-only, no backend endpoint
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
