import React, { useState, useEffect } from "react";
import { Box, Container, Typography, Button, Grid, TextField, MenuItem, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import JobCard from "../components/JobCard/JobCard";
import NewsletterSection from "../components/NewsletterSection";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar/Navbar";


const filtersDefault = {
  search: "",
  location: "",
  type: "",
};

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [filters, setFilters] = useState(filtersDefault);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const res = await fetch("http://localhost:5000/api/jobs");
    const data = await res.json();
    setJobs(data);
  };

  // Filtering logic
  const filteredJobs = jobs.filter((job) => {
    return (
      (filters.search === "" || job.title.toLowerCase().includes(filters.search.toLowerCase())) &&
      (filters.location === "" || job.location === filters.location) &&
      (filters.type === "" || job.type === filters.type)
    );
  });

  return (
    <>
      {/* Gradient Hero Section */}
      <Box sx={{
  background: "linear-gradient(135deg, #c3abfa 0%, #7046d3 100%)",
  py: 7,
  mb: 2
}}>
  <Container>
    <Typography variant="h3" fontWeight={900} color="#462478" align="center" gutterBottom>
      Your Next Career Move Awaits!
    </Typography>
    <Typography variant="h6" align="center" color="#462478" sx={{ mb: 3, opacity: 0.7 }}>
      Explore startup, remote, on-site, and big company openings. Fresh, ongoing, and future jobs—all in one place.
    </Typography>
  </Container>
</Box>


      {/* Search Bar & Filters, floating over the gradient */}
     <Container sx={{ mb: 3 }}>
  <Box
    sx={{
      bgcolor: "#fff",
      p: 2,
      mb: 2,
      borderRadius: 3,
      boxShadow: 2,
      display: "flex",
      gap: 2,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: "900px",
      mx: "auto"
    }}
  >

          <TextField
            variant="outlined"
            placeholder="Search jobs, companies..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 220 }}
          />
          <TextField
            select
            label="Location"
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Remote">Remote</MenuItem>
            <MenuItem value="Gurgaon">Gurgaon</MenuItem>
            <MenuItem value="Bangalore">Bangalore</MenuItem>
          </TextField>
          <TextField
            select
            label="Type"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Full-time">Full-time</MenuItem>
            <MenuItem value="Contract">Contract</MenuItem>
            <MenuItem value="Internship">Internship</MenuItem>
          </TextField>
          <Button
            variant="contained"
            color="primary"
            sx={{ ml: 2, fontWeight: 700 }}
            onClick={() => setVisibleCount(6)}
          >
            Search
          </Button>
        </Box>
      </Container>

      {/* Recent Jobs Section */}
      <Container>
        <Typography variant="h5" fontWeight={700} color="#5f43b2" align="center" sx={{ mb: 2 }}>
          Recent Jobs
        </Typography>
        <Grid container spacing={3} justifyContent="center">
          {filteredJobs.slice(0, visibleCount).map((job) => (
            <Grid item xs={12} sm={6} md={4} key={job._id}>
              <JobCard job={job} />
            </Grid>
          ))}
        </Grid>
        {visibleCount < filteredJobs.length && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              variant="outlined"
              color="primary"
              sx={{ fontWeight: 600, borderRadius: 2, px: 5 }}
              onClick={() => setVisibleCount((prev) => Math.min(prev + 6, filteredJobs.length))}
            >
              View More
            </Button>
          </Box>
        )}
      </Container>

      {/* Features Section */}
      <Box sx={{ bgcolor: "#fff", py: 6, mt: 7 }}>
        <Container>
          <Typography variant="h5" fontWeight={700} align="center" color="primary" sx={{ mb: 2 }}>
            Why Choose Us?
          </Typography>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 2, borderRadius: 2, boxShadow: 1, textAlign: "center" }}>
                <Typography fontWeight={700}>Startup Focus</Typography>
                <Typography color="text.secondary" variant="body2">
                  Freshest startup and tech jobs.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 2, borderRadius: 2, boxShadow: 1, textAlign: "center" }}>
                <Typography fontWeight={700}>Verified Listings</Typography>
                <Typography color="text.secondary" variant="body2">
                  Genuine, hand-checked companies.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 2, borderRadius: 2, boxShadow: 1, textAlign: "center" }}>
                <Typography fontWeight={700}>Remote First</Typography>
                <Typography color="text.secondary" variant="body2">
                  Fully-remote jobs available worldwide.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <NewsletterSection />
      <Footer />
    </>
  );
}
