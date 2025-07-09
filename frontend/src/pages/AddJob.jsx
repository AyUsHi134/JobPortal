import React, { useState, useContext, useEffect } from 'react';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AddJob() {
  const { user } = useContext(AuthContext);          // 1️⃣ Always call hooks at the top
  const nav      = useNavigate();
  const [form, setForm] = useState({                 // 2️⃣ Move useState above any returns
    title: '',
    company: '',
    location: '',
    category: '',
    url: '',
  });
  const [loading, setLoading] = useState(false);     // 3️⃣ Add loading state

  // 4️⃣ Redirect in effect, not in render
  useEffect(() => {
    if (!user) {
      nav('/login');
    }
  }, [user, nav]);

  const handle = e => setForm({ 
    ...form, 
    [e.target.name]: e.target.value 
  });

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (data._id) {
        nav('/jobs');
      } else {
        alert(data.message || 'Failed to add job');
      }
    } catch (err) {
      console.error(err);
      alert('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;  // 5️⃣ Keep render guard after hooks

  return (
    <form 
      onSubmit={submit} 
      className="max-w-md mx-auto p-6 bg-card-bg rounded shadow mt-10"
    >
      <h2 className="text-2xl mb-4">Add Job</h2>

      {['title','company','location','category','url'].map(f => (
        <input
          key={f}
          name={f}
          placeholder={f}
          value={form[f]}
          onChange={handle}
          className="w-full mb-3 p-2 border rounded"
          required
        />
      ))}

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 rounded 
          ${loading ? 'bg-gray-400' : 'bg-lavender text-white'}`}
      >
        {loading ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
