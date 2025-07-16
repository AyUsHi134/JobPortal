import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Card, CardContent, Typography, Button } from "@mui/material";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/jobs/${id}`)
      .then(res => res.json())
      .then(setJob);
  }, [id]);

  if (!job) return <Container sx={{ mt: 8 }}>Loading...</Container>;

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" color="primary" fontWeight={800} gutterBottom>
            {job.title}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {job.company} | {job.location} | {job.type}
          </Typography>
          <Typography sx={{ mt: 2, mb: 2 }}>
            {job.description}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ mr: 2 }}
          >
            Apply Now
          </Button>
          <Button
            variant="outlined"
            color="primary"
            component={Link}
            to="/"
          >
            Back to Jobs
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}
