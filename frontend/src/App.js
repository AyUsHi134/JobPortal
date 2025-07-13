import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import JobDetail from "./pages/JobDetail";
import Navbar from "./components/Navbar";
import AddJob from "./pages/AddJob";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/add-job" element={<AddJob />} />
      </Routes>
    </>
  );
}
