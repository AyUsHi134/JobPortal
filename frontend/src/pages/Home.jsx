import React, { useEffect, useState } from "react";
import JobCard from "../components/JobCard";

const Home = () => {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/remoteok-jobs")
      .then(res => res.json())
      .then(data => setJobs(data))
      .catch(() => setJobs([]));
  }, []);

  const filteredJobs = jobs.filter(job =>
    job.position?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#ECE6F7" }}>
      <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, color: "#5F43B2", fontWeight: 700 }}>Find Your Dream Job in Startups</h1>
        <input
          placeholder="Search by position"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: 14, margin: "2rem 0",
            borderRadius: 8, border: "1px solid #C9B6F7", background: "#F6F3FA", fontSize: 16
          }}
        />
        <div>
          {filteredJobs.slice(0, 20).map(job => (
            <JobCard job={job} key={job.id} />
          ))}
        </div>
      </div>
    </div>
  );
};
export default Home;
