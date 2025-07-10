// backend/controllers/jobs.js
import axios from 'axios';
import Job   from '../models/Job.js';
import User  from '../models/User.js';

export async function getAll(req, res) {
  try {
    const remote = (await axios.get(process.env.REMOTEOK_API)).data;
    const publicJobs = remote.filter(j => j.position);
    const localJobs  = await Job.find().populate('author', 'name');
    res.json({ publicJobs, localJobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching jobs' });
  }
}

export async function create(req, res) {
  try {
    const job = new Job({ ...req.body, author: req.user });
    const saved = await job.save();
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating job' });
  }
}

export async function remove(req, res) {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || job.author.toString() !== req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    await job.remove();
    res.json({ message: 'Deleted job' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting job' });
  }
}

export async function bookmark(req, res) {
  try {
    const user = await User.findById(req.user);
    const idx  = user.bookmarks.indexOf(req.params.id);
    if (idx < 0) user.bookmarks.push(req.params.id);
    else         user.bookmarks.splice(idx, 1);
    await user.save();
    res.json(user.bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error bookmarking job' });
  }
}
