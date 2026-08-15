
import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx"; 

import Navbar from "./components/Navbar/Navbar";
import FindJob from "./pages/FindJob/FindJob";
import About from "./pages/About/About";
import Contact from "./pages/Contact/Contact";
import Home from "./pages/Home";
import Login from "./pages/Login/Login.jsx";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import AddJob from "./pages/AddJob";
import JobDetail from "./pages/JobDetail/JobDetail";
import ForgotPassword from "./pages/ForgotPassword";
import JobDescription from "./pages/JobDescription/JobDescription"; 

<Route path="/job/:id" element={<JobDescription />} />


export default function App() {
  return (
    <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/add-job" element={<AddJob />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/jobs" element={<FindJob />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/job/:id" element={<JobDescription />} />
        </Routes>
    </AuthProvider>
  );
}
