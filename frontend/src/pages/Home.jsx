import React, { useEffect, useState } from "react";
import { Box, Container, Typography, Button, TextField, Grid, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate, Link } from "react-router-dom";
import "../components/JobCard/JobCard.scss";
import "./Home.scss";
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
      {/* The navbar (a separate component, App.jsx renders it as a plain
          sibling above <Routes>) is `position: sticky` with a translucent
          glass background — it only actually overlaps colored page
          content once you've scrolled past its own height, so at scroll
          position 0 there is nothing sage-colored behind it yet (only the
          plain page-wide body background). This purely decorative,
          non-interactive strip fixes that: pinned to the viewport's top
          edge behind the navbar (z-index below it, but above normal page
          content's default stacking so it doesn't peek out anywhere real
          content hasn't loaded yet — and below normal content once it
          scrolls into view, so it's harmlessly hidden the instant real
          content covers that band). It reads the exact same
          background.sage theme token Home's own two-column section uses
          below (no new/hardcoded color), just via the theme-function form
          rather than the literal "background.sage" string so it can't be
          mistaken for that real section by anything scanning for it. Its
          height only needs to safely exceed the navbar's own rendered
          height at any breakpoint — it's harmless if slightly taller,
          since real content always paints over it once scrolled into
          that band. Home.jsx/Navbar.scss's actual layout, height,
          spacing, and routes are otherwise untouched. */}
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

      {/* SS3 composition: the search toolbar is no longer a full-width row
          of its own above the sage section — it now sits INSIDE the sage
          two-column area, as the first element of the narrow LEFT column
          (Search -> Career card -> Why Choose Us), matching a mockup's
          "narrow sidebar, search at its top" proportions. The old
          standalone white medium-width search Container above this
          section is gone entirely (no more separate white band under the
          navbar); the sage background now starts directly beneath the navbar's own
          border-bottom divider (untouched in Navbar.scss). RIGHT column is
          still Recent Jobs (heading + real job-card grid), unchanged.
          `maxWidth="xl"` still gives the right column enough width for its
          3 cards to render at a width/proportion consistent with Find
          Jobs' own job-card grid. The left column's flex-basis/maxWidth
          was narrowed from {md:460} to {md:400} in a later pass to give
          Recent Jobs slightly more horizontal space, while the Career/Why
          Choose Us cards' own heights/padding/typography are untouched —
          only the shared column width changed. */}
      <Box sx={{ bgcolor: "background.sage", pt: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 } }}>
        <Container maxWidth="xl">
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 4 }}>
            <Box sx={{ flex: "1 1 280px", maxWidth: { md: 400 }, display: "flex", flexDirection: "column", gap: 2.5 }}>
              {/* Search — the left column's first element, still one
                  horizontal search control (icon + input, Search button on
                  the right) inside a single bordered/rounded outer Box.
                  The container's own background is now transparent (was
                  background.paper) so the sage page background shows
                  through, per this pass's explicit glass-style request;
                  the TextField's own outline stays suppressed (its
                  fieldset border only, via sx) so the border you see is
                  still just the outer container's one border. The Button
                  is back to its normal rounded/contained shape with a
                  small explicit gap (1 unit = 8px) from the input, rather
                  than the previous flush/clipped-square treatment — still
                  not full-width, still anchored to the right via
                  flexShrink:0. The container is never given its own width
                  (it simply fills the column, same as always), so it can't
                  grow wider than the existing left column. Every other
                  piece — placeholder/aria-label, the search icon, the
                  Button's green contained styling, and handleHeroSearch/
                  validateSearchQuery wiring — is untouched. */}
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
                    // Left/content-side padding only (12px -> 16px) — the
                    // search icon and typed text now get slightly more
                    // internal breathing room. Right padding (before the
                    // Search button) is deliberately untouched so the
                    // button's own dimensions/position don't shift.
                    pl: 2,
                    pr: 0.75,
                    py: 0.5,
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
                    sx={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": { border: "none" },
                    }}
                  />
                  {/* A compact ~100x44 fixed footprint (was an
                      unconstrained default-medium contained Button) —
                      flexShrink:0 keeps it from being squeezed by the
                      input's own flex:1, and it was never given
                      alignSelf:"stretch", so it doesn't grow to fill the
                      container's height. minHeight/lineHeight are pinned
                      explicitly too, defensively, so neither MUI's own
                      Button defaults nor the global bare `button {
                      min-height }` rule in main.scss can quietly re-expand
                      it. Color, variant, rounded corners, bold weight, and
                      label are all unchanged. */}
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
                  // Narrower than the left column itself (which stays the
                  // same width as Why Choose Us, untouched below) — width
                  // and minHeight are both exactly unchanged from before.
                  // mx:"auto" centers this narrower card horizontally
                  // within the column (was flex-start/flush-left) so the
                  // leftover horizontal space reads as balanced on both
                  // sides rather than only ever sitting on the right.
                  width: { xs: "100%", sm: "85%" },
                  mx: "auto",
                  borderRadius: 3,
                  p: { xs: 4, sm: 5 },
                  // A content-safe MINIMUM presence (a floor, never a cap)
                  // so the card feels like a deliberate feature panel —
                  // it can only grow taller if the content needs more
                  // room, never clip it, same principle as JobCard's own
                  // min-height. Unchanged from before — only the text size
                  // below grew, to fill this same footprint more naturally.
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

              {/* Why Choose Us — moved from its old standalone full-width
                  background.paper section (see below the two-column area's
                  old location) into a compact stacked card here; same
                  heading/three feature texts, unchanged, just a vertical
                  list instead of a 3-wide Grid (this narrow column has no
                  room for 3-across). mt:0.75 adds 6px on top of the
                  column's own 20px gap (2.5 units), for ~26px total
                  between the Career card and this block specifically —
                  the Search-to-Career gap above is untouched since this
                  margin lives only on this box. */}
              <Box
                sx={{
                  mt: 0.75,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 3, sm: 4 },
                  // A responsive minHeight floor (never a fixed height) —
                  // same "~28rem tall on desktop" mockup reference the
                  // Career card above uses, adapted rather than copied
                  // literally, so this card reads as equally substantial
                  // rather than a shorter afterthought beneath it.
                  minHeight: { xs: 260, sm: 320, md: 380 },
                }}
              >
                <Typography variant="h6" fontWeight={800} align="center" color="primary" sx={{ mb: 3 }}>
                  Why Choose Us?
                </Typography>
                {/* Three visually distinct feature cards (very light
                    lavender/blue/green — the same restrained $badge-*
                    accent pairs JobCard's own tags use, not a new
                    palette), each with a subtle staggered fade-up entrance
                    defined in Home.scss. Same three features/text as
                    before, unchanged. */}
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
              {/* The short accent-bar underline that used to sit beneath
                  this heading is removed per an earlier pass's explicit
                  request (color/align unchanged). fontSize bumped modestly
                  above h5's own 1.5rem default (still bold, still the same
                  green secondary.main) for a visually stronger heading;
                  mb stays at 1 — the increase is modest enough that the
                  existing gap to the job grid still reads as natural. */}
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

              {/* 3 cards/row on desktop, 2 on tablet, 1 on mobile — MUI v7's
                  Grid (this project is on @mui/material 7.2.0) replaced the
                  old item/xs/sm/md prop API with a single `size` prop; using
                  the old API here silently no-ops (falls back to auto-sizing).
                  Replaces the old JobCard.scss .jobs-list/.jobs-list-item
                  flex wrapper (whose fixed 340px card basis only fit 2
                  across this column's narrower width). JobCard itself is
                  untouched; only its grid wrapper changed. rowSpacing was
                  split out from the shared spacing={3} and lowered, then
                  lowered again (1 -> 0.5) — the Grid's own row gap was
                  stacking on top of JobCard.scss's own unmodified
                  `.modern-job-card { margin: 24px auto; }`, making the
                  vertical gap between rows read as too large;
                  columnSpacing (horizontal, between cards in the same row)
                  is untouched at 3. */}
              {jobs.length > 0 && (
                <Grid container rowSpacing={0} columnSpacing={3} sx={{ mt: 2.5}}>
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
    </>
  );
}
