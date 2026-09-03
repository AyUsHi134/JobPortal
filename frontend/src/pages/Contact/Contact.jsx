import React, { useState } from "react";
import { Alert } from "@mui/material";
import "./Contact.scss";

// Converted from an uncontrolled, no-op form to match this app's dominant
// controlled-form pattern (Signup.jsx/AddJob.jsx/Profile.jsx): controlled
// state per field, an idle/submitting/success/error status machine, and an
// MUI <Alert> for the result message (same severity/role/placement style
// Signup.jsx uses — right after the heading, before the form). There is no
// backend endpoint for contact submissions, so "submit" builds and opens a
// mailto: link as a client-only fallback rather than calling a service.
export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [message, setMessage] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (status === "submitting") return;

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setMessage("Please fill in your name, email, and message before sending.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const subject = encodeURIComponent(`Message from ${form.name}`);
      const body = encodeURIComponent(`${form.message}\n\nFrom: ${form.name} (${form.email})`);
      window.location.href = `mailto:support@jobportal.com?subject=${subject}&body=${body}`;
      setStatus("success");
      setMessage("Your email client should now be open with your message ready to send.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setMessage("Could not open your email client. Please email support@jobportal.com directly.");
      setStatus("error");
    }
  };

  return (
    <div className="contact-page">
      <h2>Contact Us</h2>

      {status === "success" && (
        <Alert severity="success" role="status" sx={{ mb: 2 }}>{message}</Alert>
      )}
      {status === "error" && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>{message}</Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          aria-label="Your Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          aria-label="Your Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <textarea
          name="message"
          placeholder="Message"
          aria-label="Message"
          rows={4}
          value={form.message}
          onChange={handleChange}
          required
        />
        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending..." : "Send Message"}
        </button>
      </form>

      <div className="contact-info">
        <span>Email: support@jobportal.com</span>
        <span>Phone: +91-12345-67890</span>
      </div>
    </div>
  );
}
