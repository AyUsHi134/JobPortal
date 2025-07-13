import React, { useState, useEffect } from "react";
import { Container, Card, CardContent, Typography, Button, Avatar, TextField } from "@mui/material";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });

  useEffect(() => {
    fetch("http://localhost:5000/api/user/profile", {
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setForm({ name: data.name, email: data.email });
      });
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEdit() {
    setEditing(true);
  }

  function handleSave() {
    // Here, POST to /api/user/profile to update
    fetch("http://localhost:5000/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include"
    }).then(res => {
      if (res.ok) {
        setUser(form);
        setEditing(false);
      } else {
        alert("Failed to update");
      }
    });
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Typography>Loading...</Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Avatar sx={{ width: 90, height: 90, mb: 2 }}>
            {user.name[0].toUpperCase()}
          </Avatar>
          <Typography variant="h4" color="primary" fontWeight={900} gutterBottom>
            My Profile
          </Typography>
          {editing ? (
            <>
              <TextField label="Name" name="name" value={form.name} onChange={handleChange} sx={{ mb: 2 }} fullWidth />
              <TextField label="Email" name="email" value={form.email} onChange={handleChange} sx={{ mb: 2 }} fullWidth />
              <Button onClick={handleSave} variant="contained" color="primary" sx={{ mt: 2 }}>Save</Button>
            </>
          ) : (
            <>
              <Typography variant="h6"><b>Name:</b> {user.name}</Typography>
              <Typography variant="h6"><b>Email:</b> {user.email}</Typography>
              <Button onClick={handleEdit} variant="contained" color="primary" sx={{ mt: 2 }}>Edit Profile</Button>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
