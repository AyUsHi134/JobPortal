import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Avatar, Chip, Button, Divider, Grid, Paper, Stack
} from "@mui/material";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupIcon from "@mui/icons-material/Group";
import EmojiObjectsIcon from "@mui/icons-material/EmojiObjects";
import "./JobDetail.scss";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/jobs/${id}`)
      .then((res) => res.json())
      .then(setJob);
  }, [id]);

  if (!job) return <div className="loading">Loading...</div>;

  // Dummy/fallback data for optional fields:
  const aboutCompany = job.aboutCompany || "We are a future-driven company focused on innovation and career growth.";
  const team = job.team || [
    { name: "Aayush Shukla", role: "CTO", avatar: "" },
    { name: "Sonal Jain", role: "Recruiter", avatar: "" }
  ];
  const culture = job.culture || [
    { icon: <EmojiObjectsIcon color="secondary" />, label: "Innovative" },
    { icon: <GroupIcon color="secondary" />, label: "Collaborative" },
  ];

  // Format date posted
  const datePosted = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
    : "N/A";

  return (
    <Box className="job-detail-page" sx={{ bgcolor: "#f7f3ff", minHeight: "100vh", pb: 8 }}>
      <Paper className="job-header" elevation={2} sx={{
        maxWidth: 900, mx: "auto", mt: 6, mb: 3, p: { xs: 2, md: 4 }, borderRadius: 5, background: "#fff"
      }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
          <Avatar
            src={job.company_logo}
            alt={job.company}
            sx={{ width: 82, height: 82, bgcolor: "primary.light", fontSize: 36 }}
          >
            {job.company?.[0]}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h4" fontWeight={900} color="primary" gutterBottom>
              {job.title}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {job.company} <span className="divider">|</span> {job.location} <span className="divider">|</span> {job.type}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {job.skills?.map((skill, i) => (
                <Chip key={i} label={skill} color="secondary" sx={{ mb: 1 }} />
              ))}
            </Stack>
          </Box>
          <Box align="center" minWidth={110}>
            <Typography variant="body2" color="text.secondary">
              <CalendarMonthIcon sx={{ fontSize: 18, verticalAlign: "middle", mr: 0.5 }} />
              Posted: {datePosted}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 1, borderRadius: 2 }}
              href={job.applyLink || job.apply_url || "#"}
              target="_blank"
            >
              Apply Now
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper className="job-body" elevation={1} sx={{ maxWidth: 900, mx: "auto", p: { xs: 2, md: 4 }, borderRadius: 5, background: "#fff" }}>
        <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
          Job Description
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, color: "text.secondary", whiteSpace: "pre-line" }}>
          {job.description}
        </Typography>
        <Divider sx={{ my: 3 }} />

        <Grid container spacing={4}>
          {/* About Company */}
          <Grid item xs={12} md={5}>
            <Box className="about-section">
              <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
                About the Company
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {aboutCompany}
              </Typography>
            </Box>
          </Grid>
          {/* Team */}
          <Grid item xs={12} md={4}>
            <Box className="team-section">
              <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
                Team & Contacts
              </Typography>
              {team.map((member, idx) => (
                <Box key={idx} sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.light", mr: 1 }}>
                    {member.avatar ? <img src={member.avatar} alt={member.name} style={{ width: "100%" }} /> : member.name[0]}
                  </Avatar>
                  <Typography fontWeight={600} sx={{ mr: 1 }}>{member.name}</Typography>
                  <Typography color="text.secondary">{member.role}</Typography>
                </Box>
              ))}
            </Box>
          </Grid>
          {/* Culture */}
          <Grid item xs={12} md={3}>
            <Box className="culture-section">
              <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
                Culture
              </Typography>
              <Stack direction="column" gap={1}>
                {culture.map((item, idx) => (
                  <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {item.icon}
                    <Typography color="text.secondary">{item.label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            href={job.applyLink || job.apply_url || "#"}
            target="_blank"
          >
            Apply Now
          </Button>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Back to Jobs
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
