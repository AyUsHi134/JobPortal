import React, { useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Box } from "@mui/material";

export default function AddJob() {
  const [form, setForm] = useState({ title: "", company: "", location: "", type: "", description: "" });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    const res = await fetch("http://localhost:5000/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });
    if (res.ok) {
      alert("Job added!");
      setForm({ title: "", company: "", location: "", type: "", description: "" });
    } else {
      alert("Failed to add job");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            Add New Job
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth required label="Job Title" name="title" value={form.title} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Company" name="company" value={form.company} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Location" name="location" value={form.location} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Type" name="type" value={form.type} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField fullWidth required label="Description" name="description" value={form.description} onChange={handleChange} multiline minRows={3} sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" color="primary" fullWidth>Add Job</Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
