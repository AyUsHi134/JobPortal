import React, { useState } from "react";
import { Container, Card, CardContent, Typography, TextField, Button, Avatar } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";

export default function Profile() {
  // Replace these with user info from backend!
  const [user, setUser] = useState({
    name: "Ayushi", 
    email: "ayushi@email.com", 
    resume: "",
    // add more as needed
  });

  // Add logic to handle file uploads/profile updates as needed
  const handleChange = (e) => setUser({ ...user, [e.target.name]: e.target.value });

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 2 }}>
            <PersonIcon sx={{ fontSize: 42 }} />
          </Avatar>
          <Typography variant="h5" fontWeight={800} color="primary" gutterBottom align="center">
            My Profile
          </Typography>
          <TextField
            label="Name"
            name="name"
            value={user.name}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            name="email"
            value={user.email}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
            disabled
          />
          {/* Resume upload - logic for upload to be added */}
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }}>
            Upload Resume
            <input type="file" hidden onChange={e => setUser({...user, resume: e.target.files[0]})}/>
          </Button>
          <Button variant="contained" color="primary" fullWidth>
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}
