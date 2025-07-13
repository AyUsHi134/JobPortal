// src/components/Footer.jsx
import React from "react";

export default function Footer() {
  return (
    <footer style={{
      background: "#fff",
      padding: "24px 0",
      textAlign: "center",
      color: "#aaa",
      fontSize: 15,
      marginTop: 36
    }}>
      © {new Date().getFullYear()} JobPortal. All rights reserved.
    </footer>
  );
}
