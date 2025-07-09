const axios = require('axios');
const Job   = require('../models/Job');
const User  = require('../models/User');

exports.getAll = async (req, res) => {
  try {
    const remote = (await axios.get(process.env.REMOTEOK_API)).data;
    const publicJobs = remote.filter(j => j.position);
    const localJobs  = await Job.find().populate('author','name');
    res.json({ publicJobs, localJobs });
  } catch {
    res.status(500).json({ message: 'Error fetching jobs' });
  }
};

exports.create = async (req, res) => {
  const job = new Job({ ...req.body, author: req.user });
  try {
    res.json(await job.save());
  } catch {
    res.status(500).json({ message: 'Error creating job' });
  }
};

exports.delete = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || job.author.toString() !== req.user)
      return res.status(401).json({ message: 'Not authorized' });
    await job.remove();
    res.json({ message: 'Deleted job' });
  } catch {
    res.status(500).json({ message: 'Error deleting job' });
  }
};

exports.bookmark = async (req, res) => {
  try {
    const user = await User.findById(req.user);
    const idx = user.bookmarks.indexOf(req.params.id);
    if (idx < 0) user.bookmarks.push(req.params.id);
    else user.bookmarks.splice(idx, 1);
    await user.save();
    res.json(user.bookmarks);
  } catch {
    res.status(500).json({ message: 'Error bookmarking job' });
  }
};