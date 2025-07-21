import React from "react";
import { Card, CardContent, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";

export default function JobCard({ job }) {
  return (
    <Card className="job-card" elevation={3}>
      <CardContent>
        <Typography variant="h6" color="primary" fontWeight={800} gutterBottom>
          {job.title}
        </Typography>
        <Typography color="text.secondary" fontWeight={600} gutterBottom>
          {job.company} | {job.location} | {job.type}
        </Typography>
        <Button
          component={Link}
          to={`/jobs/${job._id}`}
          variant="contained"
          color="primary"
          sx={{ mt: 2, borderRadius: 2 }}
          fullWidth
        >
          Apply Now
        </Button>
      </CardContent>
    </Card>
  );
}
