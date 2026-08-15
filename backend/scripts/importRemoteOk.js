import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import Job from "../models/Job.js";

dotenv.config({ path: '../.env' })

async function importRemoteOKJobs() {
  await mongoose.connect(process.env.MONGO_URI);

  const res = await axios.get('https://remoteok.com/api');
  const jobs = res.data;

  let imported = 0;
  for (let job of jobs) {
    if (!job.position || !job.company) continue;

    await Job.updateOne(
      { apply_link: job.apply_url }, 
      {
        title: job.position,
        company: job.company,
        location: job.location || "Remote",
        description: job.description || "",
        tags: job.tags || [],
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        apply_link: job.apply_url,
        logo: job.logo || job.company_logo || "",
        date_posted: job.date ? new Date(job.date) : new Date(),
        source: "remoteok",
      },
      { upsert: true }
    );
    imported++;
  }
  console.log(`Imported/Updated ${imported} jobs from Remote OK!`);
  process.exit();
}

importRemoteOKJobs();
