import React from "react";
import "./Contact.scss";
export default function Contact() {
  return (
    <div className="contact-page">
      <h2>Contact Us</h2>
      <form>
        <input type="text" placeholder="Your Name" required />
        <input type="email" placeholder="Your Email" required />
        <textarea placeholder="Message" rows={4} required />
        <button type="submit">Send Message</button>
      </form>
      <div className="contact-info">
        <span>Email: support@jobportal.com</span>
        <span>Phone: +91-12345-67890</span>
      </div>
    </div>
  );
}
