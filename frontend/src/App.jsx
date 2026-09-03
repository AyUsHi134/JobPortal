
import React from "react";
import { Routes, Route } from "react-router-dom";
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

// Phase 2D: resolved the routing duplication FRONTEND_AUDIT.md §2/§3
// flagged — `/jobs/:id` used to render `JobDetail` directly with no
// `job` prop supplied (a confirmed-broken route, since `JobDetail`
// assumed `job` was always a real object) and duplicated `/job/:id`'s
// concept of "view one job's detail." `/job/:id` -> `JobDescription` was
// already the real, data-fetching route (and the one JobCard.jsx
// navigates to), so it's kept as the single canonical Job Detail route;
// `/jobs/:id` was removed rather than fixed, since keeping two routes
// for the same concept would just reintroduce the original confusion.
// The stray top-level `<Route .../>` expression statement that used to
// sit here (a harmless but dead duplicate of the real route
// registration below) was removed for the same reason.
//
// Phase 2E: registered `/saved-jobs`, which Navbar.jsx already linked to
// but which had no matching route (FRONTEND_AUDIT.md §2 — a confirmed
// dead link before this phase).

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
          <Route path="/saved-jobs" element={<SavedJobs />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/jobs" element={<FindJob />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/job/:id" element={<JobDescription />} />
        </Routes>
        <Footer />
    </AuthProvider>
  );
}
