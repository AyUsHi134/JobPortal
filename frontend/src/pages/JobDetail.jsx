import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Card, CardContent, Typography, Button } from "@mui/material";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    // Try local DB first
    fetch(`http://localhost:5000/api/jobs/${id}`)
      .then(res => {
        if (res.status === 404) {
          // Try remote API fallback (for remote-xxxx IDs)
          if (id.startsWith("remote-")) {
            return fetch(`https://www.arbeitnow.com/api/job/${id.replace("remote-", "")}`)
              .then(res2 => res2.json())
              .then(data2 => {
                if (!data2.job) {
                  setNotFound(true);
                  setLoading(false);
                  return;
                }
                setJob({
                  ...data2.job,
                  description: data2.job.description || ""
                });
                setLoading(false);
              });
          } else {
            setNotFound(true);
            setLoading(false);
            return;
          }
        }
        return res.json().then(data => {
          setJob(data);
          setLoading(false);
        });
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" align="center">Loading...</Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (notFound || !job) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="error" align="center">Job Not Found</Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  // Render remote HTML if remote job
  const isRemote = id.startsWith("remote-");

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" fontWeight={900} color="primary" gutterBottom>
            {job.title}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {job.company || job.company_name} | {job.location} | {job.type}
          </Typography>
          <div style={{ marginTop: 16 }}>
            {isRemote ? (
              <div dangerouslySetInnerHTML={{ __html: job.description }} />
            ) : (
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{job.description}</Typography>
            )}
          </div>
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 3 }}
            fullWidth
            href={job.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply Now
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}
