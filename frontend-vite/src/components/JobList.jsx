import { Grid } from "@mui/material";
import JobCard from "./JobCard";

export default function JobList({ jobs }) {
  return (
    <Grid container spacing={3} sx={{ mb: 5 }}>
      {jobs.map(job => (
        <Grid item xs={12} sm={6} md={6} key={job._id}>
          <JobCard job={job} />
        </Grid>
      ))}
    </Grid>
  );
}
