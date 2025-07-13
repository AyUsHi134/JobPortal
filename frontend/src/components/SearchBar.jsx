// src/components/SearchBar.jsx
import React, { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSubmit = e => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        margin: "32px 0"
      }}
    >
      <input
        type="text"
        placeholder="Search jobs, company, location..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid #d2bcfa",
          minWidth: 320,
          fontSize: 16
        }}
      />
      <button
        type="submit"
        style={{
          background: "#7b42f6",
          color: "#fff",
          padding: "12px 26px",
          borderRadius: 8,
          fontWeight: 700,
          border: "none"
        }}
      >
        Search
      </button>
    </form>
  );
}
