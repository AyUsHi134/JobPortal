const mongoose = require('mongoose');
const JobSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  company:  String,
  location: String,
  category: String,
  url:      String,
  postedAt: { type: Date, default: Date.now },
  author:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
module.exports = mongoose.model('Job', JobSchema);
