import React, { useEffect, useState, useContext } from 'react';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';

export default function Jobs() {
  const [publicJobs, setPublic] = useState([]);
  const [localJobs, setLocal] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    api('/api/jobs').then(data => {
      setPublic(data.publicJobs || []);
      setLocal(data.localJobs  || []);
    });
  }, []);

  const bookmark = id => {
    if (!user) return alert('Please log in first.');
    api(`/api/jobs/${id}/bookmark`, { method: 'POST' }).then(() =>
      alert('Bookmark toggled')
    );
  };

  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...localJobs, ...publicJobs].map(job => {
        const key = job._id || job.id;
        return (
          <div key={key} className="bg-card-bg p-4 rounded shadow">
            <h3 className="text-lg font-semibold">{job.position || job.title}</h3>
            <p className="text-sm">
              {job.company} — {job.location}
            </p>
            <div className="mt-2 flex justify-between">
              {/* After */}
<a
  href={job.url}
  target="_blank"
  rel="noopener noreferrer"
  className="underline"
>
  Apply
</a>

              <button onClick={() => bookmark(job._id || job.id)}>🔖</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
