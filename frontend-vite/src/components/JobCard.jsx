import { Card, CardContent, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";

export default function JobCard({ job }) {
  return (
    <Card sx={{ borderRadius: 3, boxShadow: 5, minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <CardContent>
        <Typography variant="h5" color="primary" fontWeight={800} sx={{ mb: 1 }}>
          {job.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {job.company} | {job.location} | {job.type}
        </Typography>
        <Button
          component={Link}
          to={`/jobs/${job._id}`}
          variant="contained"
          color="primary"
          sx={{ borderRadius: 2, fontWeight: 600, width: "100%" }}
        >
          Apply Now
        </Button>
      </CardContent>
    </Card>
  );
}
