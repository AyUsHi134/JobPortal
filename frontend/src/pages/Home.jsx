// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
import HeroSection from "../components/HeroSection";
import SearchBar from "../components/SearchBar";
import JobList from "../components/JobList";
import FeaturesSection from "../components/FeaturesSection";
import CompaniesSection from "../components/CompaniesSection";
import BlogPreviewSection from "../components/BlogPreviewSection";
import NewsletterSection from "../components/NewsletterSection";
import Footer from "../components/Footer";

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);

  useEffect(() => {
    // Fetch jobs from your MongoDB backend
    fetch("http://localhost:5000/api/jobs")
      .then(res => res.json())
      .then(mongoJobs => {
        // Fetch jobs from remoteok.com API (OPTIONAL)
        fetch("https://remoteok.com/api")
          .then(res => res.json())
          .then(remoteJobs => {
            // Sometimes remoteok's first item is metadata, so skip it
            const rJobs = Array.isArray(remoteJobs) ? remoteJobs.slice(1, 7) : [];
            // Format remote jobs to match your schema
            const formattedRemoteJobs = rJobs.map(j => ({
              _id: "remote-" + j.id,
              title: j.position || j.title || "RemoteOK Job",
              company: j.company || "",
              location: j.location || "Remote",
              type: "Remote",
              isRemote: true,
            }));
            const allJobs = [...mongoJobs, ...formattedRemoteJobs];
            setJobs(allJobs);
            setFilteredJobs(allJobs);
          })
          .catch(() => {
            setJobs(mongoJobs);
            setFilteredJobs(mongoJobs);
          });
      });
  }, []);

  function handleSearch(query) {
    setFilteredJobs(
      jobs.filter(j =>
        (j.title + j.company + j.location + j.type)
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    );
  }

  return (
    <>
      <HeroSection />
      <SearchBar onSearch={handleSearch} />
      <JobList jobs={filteredJobs} />
      <FeaturesSection />
      <CompaniesSection />
      <BlogPreviewSection />
      <NewsletterSection />
      <Footer />
    </>
  );
}
