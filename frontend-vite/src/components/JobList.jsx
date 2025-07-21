import React from "react";
import { Grid, Button } from "@mui/material";
import JobCard from "./JobCard";

export default function JobList({ jobs, visibleCount, setVisibleCount }) {
  return (
    <>
      <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
        {jobs.slice(0, visibleCount).map((job) => (
          <Grid item xs={12} sm={6} md={4} key={job._id}>
            <JobCard job={job} />
          </Grid>
        ))}
      </Grid>
      {visibleCount < jobs.length && (
        <Button
          onClick={() => setVisibleCount(v => v + 6)}
          variant="outlined"
          color="primary"
          sx={{ mt: 3, mx: "auto", display: "block" }}
        >
          View More
        </Button>
      )}
    </>
  );
}
