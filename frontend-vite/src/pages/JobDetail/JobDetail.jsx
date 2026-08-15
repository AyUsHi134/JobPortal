function JobDetail({ job }) {
  return (
    <div className="job-detail">
      <h1>{job.title}</h1>
      <p><b>Company:</b> {job.company}</p>
      <p><b>Location:</b> {job.location}</p>
      <div dangerouslySetInnerHTML={{ __html: job.description }} />
      {job.status && (
        <div className="job-status"><b>Status:</b> {job.status}</div>
      )}
      {job.hiring_stage && (
        <div className="job-stage"><b>Hiring Stage:</b> {job.hiring_stage}</div>
      )}
      {/* ...more fields */}
    </div>
  );
}
export default JobDetail;
