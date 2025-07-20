import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import AddJob from "./pages/AddJob";
import JobDetail from "./pages/JobDetail";
import ForgotPassword from "./pages/ForgotPassword";


export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add-job" element={<AddJob />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

      </Routes>
    </>
  );
}