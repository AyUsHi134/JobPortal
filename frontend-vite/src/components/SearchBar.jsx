import React, { useState } from "react";
import { Box, TextField, Button, MenuItem, Paper } from "@mui/material";

const locations = ["All", "Remote", "Onsite", "Hybrid", "Bangalore", "Delhi", "Mumbai"];
const types = ["All", "Full-time", "Part-time", "Internship", "Contract"];

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ location: "All", type: "All" });

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(query, filters);
  }

  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        gap: 2,
        alignItems: "center",
        mb: 3,
        mx: "auto",
        maxWidth: 700,
        boxShadow: 2,
        borderRadius: 2,
      }}
      component="form"
      onSubmit={handleSubmit}
    >
      <TextField
        placeholder="Search jobs, companies..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        variant="outlined"
        size="small"
        sx={{ flex: 2, minWidth: 0 }}
      />
      <TextField
        select
        label="Location"
        value={filters.location}
        onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
        size="small"
        sx={{ flex: 1, minWidth: 100 }}
      >
        {locations.map(loc => (
          <MenuItem key={loc} value={loc}>{loc}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Type"
        value={filters.type}
        onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
        size="small"
        sx={{ flex: 1, minWidth: 100 }}
      >
        {types.map(type => (
          <MenuItem key={type} value={type}>{type}</MenuItem>
        ))}
      </TextField>
      <Button
        type="submit"
        variant="contained"
        color="primary"
        sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
      >
        Search
      </Button>
    </Paper>
  );
}
