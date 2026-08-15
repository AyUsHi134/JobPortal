import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({
  title: String,            
  company: String,          
  location: String,         
  description: String,      
  tags: [String],           
  salary_min: Number,       
  salary_max: Number,       
  apply_link: String,       
  logo: String,           
  date_posted: Date,        
  status: String,           
  hiring_stage: String,     
  source: String,           
});

export default mongoose.model("Job", JobSchema);
