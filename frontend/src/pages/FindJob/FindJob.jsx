import React, { useState, useEffect } from "react";
import JobCard from "../../components/JobCard/JobCard";
import "./FindJob.scss";

export default function FindJob() {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    location: "",
    type: ""
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const res = await fetch("http://localhost:5000/api/jobs");
    const data = await res.json();
    setJobs(data);
  };

  const filteredJobs = jobs.filter(job =>
    (filters.search === "" || job.title.toLowerCase().includes(filters.search.toLowerCase())) &&
    (filters.location === "" || job.location === filters.location) &&
    (filters.type === "" || job.type === filters.type)
  );

  return (
    <div className="findjob-container">
      <aside className="filters">
        <h3>Filter Jobs</h3>
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filters.location}
          onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
        >
          <option value="">All Locations</option>
          <option value="Remote">Remote</option>
          <option value="Gurgaon">Gurgaon</option>
          <option value="Bangalore">Bangalore</option>
        </select>
        <select
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="Full-time">Full-time</option>
          <option value="Contract">Contract</option>
          <option value="Internship">Internship</option>
        </select>
      </aside>
      <section className="job-listings">
        <h2>All Jobs</h2>
        {filteredJobs.length === 0 && <p>No jobs found.</p>}
        <div className="job-listings__grid">
          {filteredJobs.map(job => <JobCard job={job} key={job._id} />)}
        </div>
      </section>
    </div>
  );
}
