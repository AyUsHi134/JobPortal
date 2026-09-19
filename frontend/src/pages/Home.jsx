import React, { useEffect, useRef, useState } from "react";
import { Box, Container, Typography, Button, TextField, Grid, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import "../components/JobCard/JobCard.scss";
import "./Home.scss";
import JobCard from "../components/JobCard/JobCard";
import GuestSignupCta from "../components/GuestSignupCta/GuestSignupCta";
import { listJobs } from "../services/jobsApi.js";
import { useGuestJobLimit } from "../hooks/useGuestJobLimit.js";
import { validateSearchQuery, buildJobSearchPath } from "../utils/homepageSearch.js";
import { HOMEPAGE_PAGE_SIZE, mergeUniqueJobs } from "../utils/homepageJobsState.js";

// Homepage on real backend pagination
export default function Home() {
  const navigate = useNavigate();
  const { guestLimitReached, recordJobsResponse } = useGuestJobLimit();

  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [loadError, setLoadError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Separate error for View More
  const [viewMoreError, setViewMoreError] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState(null);

  // Ref guards StrictMode double fetch
  const hasFetchedInitialJobs = useRef(false);

  // Initial teaser page, server-paginated
  useEffect(() => {
    if (hasFetchedInitialJobs.current) return;
    hasFetchedInitialJobs.current = true;

    setStatus("loading");
    listJobs({ page: 1, limit: HOMEPAGE_PAGE_SIZE })
      .then((response) => {
        setJobs(response.jobs);
        setPagination(response.pagination);
        setPage(1);
        setStatus("success");
        recordJobsResponse(response);
      })
      .catch((err) => {
        setLoadError(err.message || "Failed to load jobs.");
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordJobsResponse is a stable useCallback identity; including it would not change this effect's one-time-fetch behavior.
  }, []);

  // Backend decides guest limit
  const canLoadMore = Boolean(pagination) && pagination.page < pagination.totalPages && !guestLimitReached;

  // Synchronous re-entrancy guard
  const isFetchingMoreRef = useRef(false);

  const handleViewMore = async () => {
    if (isFetchingMoreRef.current || !canLoadMore) return;
    isFetchingMoreRef.current = true;
    setLoadingMore(true);
    setViewMoreError(null);
    const nextPage = page + 1;
    try {
      const response = await listJobs({ page: nextPage, limit: HOMEPAGE_PAGE_SIZE });
      setJobs((prev) => mergeUniqueJobs(prev, response.jobs));
      setPagination(response.pagination);
      setPage(nextPage);
      recordJobsResponse(response);
    } catch (err) {
      // View More failure keeps grid
      setViewMoreError(err.message || "Failed to load more jobs.");
    } finally {
      setLoadingMore(false);
      isFetchingMoreRef.current = false;
    }
  };

  // Search redirects to Find Jobs
  const handleHeroSearch = (e) => {
    e.preventDefault();
    const result = validateSearchQuery(searchText);
    if (!result.valid) {
      setSearchError(result.message);
      return;
    }
    setSearchError(null);
    navigate(buildJobSearchPath(result.query));
  };

  return (
    <>
      {/* Decorative strip behind navbar */}
      <Box
        aria-hidden="true"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          bgcolor: (theme) => theme.palette.background.sage,
          zIndex: -1,
        }}
      />

      {/* Search inside left column */}
      <Box sx={{ bgcolor: "background.sage", pt: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 } }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 4 }}>
            <Box sx={{ flex: "1 1 280px", maxWidth: { md: 400 }, display: "flex", flexDirection: "column", gap: 2.5 }}>
              {/* Search control styling */}
              <Box component="form" onSubmit={handleHeroSearch} noValidate sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    bgcolor: "transparent",
                    border: "1px solid",
                    borderColor: searchError ? "error.main" : "divider",
                    borderRadius: 3,
                    gap: 1,
                    // Left padding only
                    pl: 2,
                    pr: 0.75,
                    py: 0.5,
                  }}
                >
                  {/* Label removed, aria-label kept */}
                  <TextField
                    variant="outlined"
                    placeholder="e.g. React Developer"
                    aria-label="Search jobs by title, skill, or keyword"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    size="small"
                    error={Boolean(searchError)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": { border: "none" },
                    }}
                  />
                  {/* Compact fixed button footprint */}
                  <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 700, flexShrink: 0, width: 84, height: 37, minWidth: 0, minHeight: 0, lineHeight: 1, px: 1.5, py: 0 }}>
                    Search
                  </Button>
                </Box>
                {searchError && (
                  <Typography color="error" role="alert" sx={{ fontSize: "0.9rem" }}>
                    {searchError}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  // Narrower, centered card
                  width: { xs: "100%", sm: "85%" },
                  mx: "auto",
                  borderRadius: 3,
                  p: { xs: 4, sm: 5 },
                  // Content-safe minimum height
                  minHeight: { xs: 260, sm: 320, md: 400 },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  background: (theme) =>
                    `linear-gradient(115deg, ${theme.palette.primary.deep} 0%, ${theme.palette.primary.main} 40%, ${theme.palette.oliveAccent} 100%)`,
                }}
              >
                <Typography
                  variant="h4"
                  component="h1"
                  fontWeight={800}
                  color="#fff"
                  sx={{ fontSize: { xs: "1.85rem", sm: "2.3rem" }, mb: 3, lineHeight: 1.25 }}
                >
                  Your Next Career Move Awaits!
                </Typography>
                <Typography color="#fff" sx={{ opacity: 0.88, fontSize: { xs: "1.05rem", sm: "1.2rem" }, lineHeight: 1.65 }}>
                  Explore startup, remote, on-site, and big company openings, collected from multiple job sources in one place.
                </Typography>
              </Box>

              {/* Compact Why Choose Us card */}
              <Box
                sx={{
                  mt: 0.75,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 3, sm: 4 },
                  // Responsive minimum height floor
                  minHeight: { xs: 260, sm: 320, md: 380 },
                }}
              >
                <Typography variant="h6" fontWeight={800} align="center" color="primary" sx={{ mb: 3 }}>
                  Why Choose Us?
                </Typography>
                {/* Three distinct feature cards */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <Box className="home-feature-card home-feature-card--lavender">
                    <Typography className="home-feature-card__title" fontWeight={800} variant="body2" sx={{ fontSize: "1rem" }}>
                      Multi-Source Listings
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.6 }}>
                      Jobs collected from multiple sources in one place.
                    </Typography>
                  </Box>
                  <Box className="home-feature-card home-feature-card--blue">
                    <Typography className="home-feature-card__title" fontWeight={800} variant="body2" sx={{ fontSize: "1rem" }}>
                      Smart Filtering
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.6 }}>
                      Filter by experience level, remote status, and tech relevance.
                    </Typography>
                  </Box>
                  <Box className="home-feature-card home-feature-card--green">
                    <Typography className="home-feature-card__title" fontWeight={800} variant="body2" sx={{ fontSize: "1rem" }}>
                      Direct Access
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.6 }}>
                      Every listing links to the original job post so you can apply where it's posted.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: "3 1 480px", minWidth: 0 }}>
              {/* Heading accent bar removed */}
              <Typography variant="h5" fontWeight={700} color="secondary.main" align="left" sx={{ fontSize: "1.8rem", mb: 1, lineHeight: 1.3 }}>
                Recent Jobs
              </Typography>

              {status === "loading" && (
                <Typography align="center" role="status" aria-live="polite" sx={{ mb: 3 }}>
                  Loading jobs...
                </Typography>
              )}

              {loadError && (
                <Typography align="center" color="error" role="alert" sx={{ mb: 3 }}>
                  {loadError}
                </Typography>
              )}

              {status === "success" && jobs.length === 0 && !loadError && (
                <Typography align="center" role="status" sx={{ mb: 3 }}>
                  No active jobs are available right now.
                </Typography>
              )}

              {/* Responsive job card grid */}
              {jobs.length > 0 && (
                <Grid container rowSpacing={0} columnSpacing={3} sx={{ mt: 2.5}}>
                  {jobs.map((job) => (
                    <Grid key={job._id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <JobCard job={job} />
                    </Grid>
                  ))}
                </Grid>
              )}

              {viewMoreError && (
                <Typography align="center" color="error" role="alert" sx={{ mt: 3 }}>
                  {viewMoreError}
                </Typography>
              )}

              {canLoadMore && (
                <Box display="flex" justifyContent="center" mt={4}>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ fontWeight: 600, borderRadius: 2, px: 5, color: "#fff" }}
                    onClick={handleViewMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "View More"}
                  </Button>
                </Box>
              )}

              {guestLimitReached && <GuestSignupCta />}
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
}
