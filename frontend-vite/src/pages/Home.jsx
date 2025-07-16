import React, { useEffect, useState } from "react";
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
    fetch("http://localhost:5000/api/jobs")
      .then(res => res.json())
      .then(data => {
        setJobs(data);
        setFilteredJobs(data);
      });
  }, []);

  function handleSearch(query, filters) {
    setFilteredJobs(
      jobs.filter(j => {
        const textMatch =
          (j.title + j.company + j.location + j.type)
            .toLowerCase()
            .includes(query.toLowerCase());
        const locationMatch = filters.location === "All" || j.location === filters.location;
        const typeMatch = filters.type === "All" || j.type === filters.type;
        return textMatch && locationMatch && typeMatch;
      })
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
