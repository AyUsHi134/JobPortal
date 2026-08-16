import { useParams } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import JobDetail from "../JobDetail/JobDetail";


export default function JobDescription() {
  const { id } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await axios.get(`/api/jobs/${id}`); 
        setJob(res.data);
      } catch (err) {
        console.error("Error fetching job:", err);
      }
    };

    fetchJob();
  }, [id]);

  if (!job) return <p>Loading job details...</p>;

  return <JobDetail job={job} />;
}
