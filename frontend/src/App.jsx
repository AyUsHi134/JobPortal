
import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";

import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer";
import FindJob from "./pages/FindJob/FindJob";
import About from "./pages/About/About";
import Contact from "./pages/Contact/Contact";
import Home from "./pages/Home";
import Login from "./pages/Login/Login.jsx";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import AddJob from "./pages/AddJob";
import ForgotPassword from "./pages/ForgotPassword";
import JobDescription from "./pages/JobDescription/JobDescription";
import SavedJobs from "./pages/SavedJobs/SavedJobs.jsx";

// Route cleanup, saved-jobs route added

// Footer hidden on auth pages
const HIDE_FOOTER_PATHS = ["/login", "/signup", "/forgot-password"];

function AppLayout() {
  const location = useLocation();
  const showFooter = !HIDE_FOOTER_PATHS.includes(location.pathname);

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/add-job" element={<AddJob />} />
          <Route path="/saved-jobs" element={<SavedJobs />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/jobs" element={<FindJob />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/job/:id" element={<JobDescription />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
