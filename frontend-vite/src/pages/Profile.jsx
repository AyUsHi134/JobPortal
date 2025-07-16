import React, { useEffect, useState } from "react";
import {
  Container, Card, CardContent, Typography, Avatar, Button, TextField, Box, Grid, IconButton
} from "@mui/material";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import { styled } from "@mui/material/styles";

const Input = styled("input")({ display: "none" });

export default function Profile() {
  const [user, setUser] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    resume: null,
    avatar: null,
  });

  useEffect(() => {
    fetch("http://localhost:5000/api/user/profile", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setForm({
          name: data.name,
          email: data.email,
          username: data.username,
          password: "",
          resume: data.resume || null,
          avatar: data.avatar || null,
        });
      });
  }, []);

  const handleInputChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = e => {
    setForm({ ...form, [e.target.name]: e.target.files[0] });
  };

  const handleSave = async e => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(form).forEach(key => {
      if (form[key]) formData.append(key, form[key]);
    });
    const res = await fetch("http://localhost:5000/api/user/profile", {
      method: "PUT",
      body: formData,
      credentials: "include",
    });
    if (res.ok) {
      alert("Profile updated!");
      setEdit(false);
      window.location.reload();
    } else {
      alert("Failed to update");
    }
  };

  if (!user) return <Container sx={{ mt: 8 }}>Loading...</Container>;

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
            My Profile
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <label htmlFor="avatar-upload">
              <Input
                accept="image/*"
                id="avatar-upload"
                type="file"
                name="avatar"
                onChange={handleFileChange}
                disabled={!edit}
              />
              <IconButton color="primary" component="span" disabled={!edit}>
                <Avatar
                  sx={{ width: 90, height: 90 }}
                  src={form.avatar ? URL.createObjectURL(form.avatar) : user.avatarUrl}
                  alt={form.name || user.name}
                />
                {edit && <PhotoCamera sx={{ position: "absolute", bottom: 0, right: 0, bgcolor: "#fff", borderRadius: 999 }} />}
              </IconButton>
            </label>
          </Box>
          <Box component="form" onSubmit={handleSave}>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleInputChange}
              fullWidth sx={{ mb: 2 }} disabled={!edit}
            />
            <TextField
              label="Username"
              name="username"
              value={form.username}
              onChange={handleInputChange}
              fullWidth sx={{ mb: 2 }} disabled={!edit}
            />
            <TextField
              label="Email"
              name="email"
              value={form.email}
              onChange={handleInputChange}
              fullWidth sx={{ mb: 2 }} disabled
            />
            <TextField
              label="Password"
              name="password"
              value={form.password}
              type="password"
              onChange={handleInputChange}
              fullWidth sx={{ mb: 2 }} disabled={!edit}
            />
            <Box sx={{ mb: 2 }}>
              <label htmlFor="resume-upload">
                <Input
                  id="resume-upload"
                  type="file"
                  name="resume"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={!edit}
                />
                <Button variant="contained" component="span" disabled={!edit}>
                  Upload Resume
                </Button>
                {user.resumeUrl &&
                  <a
                    href={user.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 12, color: "#5f43b2" }}
                  >
                    View Resume
                  </a>
                }
              </label>
            </Box>
            {edit ? (
              <Button type="submit" variant="contained" color="primary" fullWidth>
                Save Changes
              </Button>
            ) : (
              <Button onClick={() => setEdit(true)} variant="outlined" color="primary" fullWidth>
                Edit Profile
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
