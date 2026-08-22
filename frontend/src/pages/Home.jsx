import React, { useEffect, useState } from "react";
import { Box, Container, Typography, Button, TextField, Grid, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate, Link } from "react-router-dom";
import "../components/JobCard/JobCard.scss";
import "./Home.scss";
import Footer from "../components/Footer";
import JobCard from "../components/JobCard/JobCard";
import { listJobs } from "../services/jobsApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { validateSearchQuery, buildJobSearchPath } from "../utils/homepageSearch.js";
import {
  HOMEPAGE_PAGE_SIZE,
  GUEST_JOB_LIMIT,
  mergeUniqueJobs,
  capJobsForGuest,
  canLoadMoreHomepageJobs,
  shouldShowGuestSignupCta,
} from "../utils/homepageJobsState.js";

// Phase 2G-3: rebuilt the homepage's search + job-browsing behavior onto
// real backend pagination and an honest guest-browsing limit, and
// rewrote the marketing copy to only claim what this product actually
// does. All state-transition rules (merge/dedupe, the guest cap, when
// "View More" may fire) live in the pure utils/homepageJobsState.js —
// this component only wires them to React state and the existing
// centralized jobsApi service; see testHomepageJobs.js/testHomepageSearch.js.
export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [loadError, setLoadError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState(null);

  // Initial "Recent Jobs" page — a short teaser via real server-side
  // pagination (page 1, a sensible small limit), never a bare-array
  // assumption about GET /api/jobs (FRONTEND_AUDIT.md §9). The full
  // discovery experience with search/filters/sort lives on /jobs
  // (FindJob.jsx, Phase 2C) — this section's job is just a browsable
  // preview.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listJobs({ page: 1, limit: HOMEPAGE_PAGE_SIZE })
      .then(({ jobs: fetchedJobs, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setJobs(fetchedJobs);
        setPagination(fetchedPagination);
        setPage(1);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || "Failed to load jobs.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canLoadMore = canLoadMoreHomepageJobs({ jobsCount: jobs.length, pagination, isAuthenticated });
  const showGuestSignupCta = shouldShowGuestSignupCta({ jobsCount: jobs.length, pagination, isAuthenticated });

  const handleViewMore = async () => {
    if (loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    setLoadError(null);
    const nextPage = page + 1;
    try {
      const { jobs: fetchedJobs, pagination: fetchedPagination } = await listJobs({
        page: nextPage,
        limit: HOMEPAGE_PAGE_SIZE,
      });
      setJobs((prev) => capJobsForGuest(mergeUniqueJobs(prev, fetchedJobs), isAuthenticated));
      setPagination(fetchedPagination);
      setPage(nextPage);
    } catch (err) {
      setLoadError(err.message || "Failed to load more jobs.");
    } finally {
      setLoadingMore(false);
    }
  };

  // The homepage search never calls the jobs API itself and never
  // duplicates FindJob.jsx's real backend-side search — an empty/
  // whitespace-only query is rejected inline (no request, user stays on
  // the homepage); a meaningful query hands off to the existing Job
  // Discovery route, which performs the actual search.
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
      {/* Navbar + Search merged into one continuous white top shell (no
          sage gap between them): this full-bleed background.paper Box sits
          directly under the navbar (whose own border-bottom already
          supplies the "still visually distinguishable" divider — untouched
          in Navbar.scss), so the search toolbar reads as the shell's own
          second section rather than a separate floating card over a
          visible sage strip. The form itself keeps its own border/shadow
          for internal definition; only its OUTER background changed —
          handleHeroSearch/validateSearchQuery wiring is untouched. */}
      <Box sx={{ bgcolor: "background.paper" }}>
        <Container maxWidth="xl" sx={{ pt: { xs: 2, sm: 2.5 }, pb: { xs: 1.5, sm: 2 } }}>
          <Box
            component="form"
            onSubmit={handleHeroSearch}
            noValidate
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2,
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              alignItems: "center",
              // Narrower, centered search card on desktop (~80% of the
              // content width) — mobile/tablet stay full-width, unchanged.
              maxWidth: { xs: "100%", md: "80%" },
              mx: "auto",
            }}
          >
            {/* Phase 2G-7B: the outlined MUI `label` prop was removed —
                with both a label and a placeholder set, MUI only shows
                the placeholder once the label has already shrunk onto
                the border (on focus/with a value), so at rest the field
                showed the label text sitting awkwardly cut into the
                border instead of the useful "e.g. React Developer"
                example. The example placeholder is kept, and the
                accessible name now comes from `aria-label` alone (a real
                accessible label, not decorative border text) so nothing
                about the field's accessibility is lost. */}
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
              sx={{ minWidth: { xs: "100%", sm: 260 }, flex: { xs: "1 1 100%", sm: "1 1 auto" } }}
            />
            <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 700 }}>
              Search
            </Button>
            {searchError && (
              <Typography color="error" role="alert" sx={{ flexBasis: "100%", fontSize: "0.9rem" }}>
                {searchError}
              </Typography>
            )}
          </Box>
        </Container>
      </Box>

      {/* Two-column dashboard area (SS1 composition): LEFT column now
          stacks the green career card AND the "Why Choose Us?" content
          (moved here from its old standalone full-width white section,
          restyled as a compact supporting card rather than a large
          3-across band — same text/features, no duplication); RIGHT
          column is Recent Jobs (heading + real job-card grid), unchanged.
          `maxWidth="xl"` (was the MUI default "lg") gives the right
          column enough width for its 3 cards to render at a width/
          proportion consistent with Find Jobs' own job-card grid, instead
          of the narrower ~247px cards the tighter "lg" container produced. */}
      <Box sx={{ bgcolor: "background.sage", pt: { xs: 4, sm: 5 }, pb: { xs: 3, sm: 4 } }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 3 }}>
            <Box sx={{ flex: "1 1 260px", maxWidth: { md: 400 }, display: "flex", flexDirection: "column", gap: 2 }}>
              <Box
                sx={{
                  borderRadius: 3,
                  p: { xs: 3, sm: 3.5 },
                  // A content-safe MINIMUM presence (a floor, never a cap)
                  // so the card feels substantial even with short text —
                  // it can only grow taller if the content needs more
                  // room, never clip it, same principle as JobCard's own
                  // min-height.
                  minHeight: { sm: 200, md: 220 },
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
                  sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem" }, mb: 1.5, lineHeight: 1.25 }}
                >
                  Your Next Career Move Awaits!
                </Typography>
                <Typography color="#fff" sx={{ opacity: 0.88, fontSize: "0.95rem", lineHeight: 1.6 }}>
                  Explore startup, remote, on-site, and big company openings, collected from multiple job sources in one place.
                </Typography>
              </Box>

              {/* Why Choose Us — moved from its old standalone full-width
                  background.paper section (see below the two-column area's
                  old location) into a compact stacked card here; same
                  heading/three feature texts, unchanged, just a vertical
                  list instead of a 3-wide Grid (this narrow column has no
                  room for 3-across). */}
              <Box
                sx={{
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 2, sm: 2.5 },
                }}
              >
                <Typography variant="h6" fontWeight={700} align="center" color="primary" sx={{ mb: 1.5 }}>
                  Why Choose Us?
                </Typography>
                {/* Three visually distinct feature cards (very light
                    lavender/blue/green — the same restrained $badge-*
                    accent pairs JobCard's own tags use, not a new
                    palette), each with a subtle staggered fade-up entrance
                    defined in Home.scss. Same three features/text as
                    before, unchanged. */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  <Box className="home-feature-card home-feature-card--lavender">
                    <Typography className="home-feature-card__title" fontWeight={700} variant="body2">
                      Multi-Source Listings
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Jobs collected from multiple sources in one place.
                    </Typography>
                  </Box>
                  <Box className="home-feature-card home-feature-card--blue">
                    <Typography className="home-feature-card__title" fontWeight={700} variant="body2">
                      Smart Filtering
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Filter by experience level, remote status, and tech relevance.
                    </Typography>
                  </Box>
                  <Box className="home-feature-card home-feature-card--green">
                    <Typography className="home-feature-card__title" fontWeight={700} variant="body2">
                      Direct Access
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Every listing links to the original job post so you can apply where it's posted.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: "3 1 480px", minWidth: 0 }}>
              <Typography variant="h5" fontWeight={700} color="secondary.main" align="left" sx={{ mb: 1 }}>
                Recent Jobs
              </Typography>
              {/* A very subtle green accent underline beneath the heading —
                  a thin, short bar, not a decorative rule spanning the whole
                  width; purely visual, no new color (reuses primary.main).
                  Left-aligned (no centering margin) so it sits naturally
                  under the now-left-aligned heading instead of centered
                  across the column. */}
              <Box sx={{ width: 56, height: 3, bgcolor: "primary.main", borderRadius: 2, mb: 3 }} />

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

              {/* 3 cards/row on desktop, 2 on tablet, 1 on mobile — MUI v7's
                  Grid (this project is on @mui/material 7.2.0) replaced the
                  old item/xs/sm/md prop API with a single `size` prop; using
                  the old API here silently no-ops (falls back to auto-sizing).
                  Replaces the old JobCard.scss .jobs-list/.jobs-list-item
                  flex wrapper (whose fixed 340px card basis only fit 2
                  across this column's narrower width). JobCard itself is
                  untouched; only its grid wrapper changed. */}
              {jobs.length > 0 && (
                <Grid container spacing={3}>
                  {jobs.map((job) => (
                    <Grid key={job._id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <JobCard job={job} />
                    </Grid>
                  ))}
                </Grid>
              )}

              {canLoadMore && (
                <Box display="flex" justifyContent="center" mt={4}>
                  <Button
                    variant="outlined"
                    color="primary"
                    sx={{ fontWeight: 600, borderRadius: 2, px: 5 }}
                    onClick={handleViewMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "View More"}
                  </Button>
                </Box>
              )}

              {showGuestSignupCta && (
                <Box
                  sx={{
                    mt: 4,
                    mx: "auto",
                    maxWidth: 480,
                    textAlign: "center",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 3,
                  }}
                >
                  <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                    Want to explore more jobs?
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                    Create a free account to continue browsing beyond the first {GUEST_JOB_LIMIT} jobs.
                  </Typography>
                  <Button component={Link} to="/signup" variant="contained" color="primary" sx={{ fontWeight: 700 }}>
                    Sign Up
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      <Footer />
    </>
  );
}
