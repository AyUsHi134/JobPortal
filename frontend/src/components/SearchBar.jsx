import React from "react";
import { Box, TextField, MenuItem, Button, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

export default function SearchBar({ filters, setFilters, onSearch }) {
  return (
    <Box className="search-bar-wrapper" sx={{
      bgcolor: "#fff",
      p: 2, borderRadius: 3, boxShadow: 2,
      display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center",
      maxWidth: 700, margin: "auto"
    }}>
      <TextField
        variant="outlined"
        placeholder="Search jobs, companies..."
        value={filters.search}
        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="primary" />
            </InputAdornment>
          )
        }}
        sx={{ minWidth: 160 }}
      />
      <TextField
        select label="Location" size="small"
        value={filters.location}
        onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
        sx={{ minWidth: 110 }}
      >
        <MenuItem value="">All</MenuItem>
        <MenuItem value="Remote">Remote</MenuItem>
        <MenuItem value="Gurgaon">Gurgaon</MenuItem>
        <MenuItem value="Bangalore">Bangalore</MenuItem>
      </TextField>
      <TextField
        select label="Type" size="small"
        value={filters.type}
        onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
        sx={{ minWidth: 110 }}
      >
        <MenuItem value="">All</MenuItem>
        <MenuItem value="Full-time">Full-time</MenuItem>
        <MenuItem value="Contract">Contract</MenuItem>
        <MenuItem value="Internship">Internship</MenuItem>
      </TextField>
      <Button variant="contained" color="primary" sx={{ fontWeight: 700 }} onClick={onSearch}>
        Search
      </Button>
    </Box>
  );
}
