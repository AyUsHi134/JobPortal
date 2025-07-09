import React, { useState, useContext } from 'react';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const { login } = useContext(AuthContext);
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (data.token) {
      login(data);
      nav('/jobs');
    } else {
      alert(data.message);
    }
  };

  return (
    <div className="min-h-screen bg-lavender flex items-center justify-center">
      <form onSubmit={submit} className="bg-card-bg p-8 rounded shadow w-80">
        <h2 className="text-2xl mb-4">Sign up</h2>
        {['name', 'email', 'password'].map(f => (
          <input
            key={f}
            name={f}
            type={f === 'password' ? 'password' : 'text'}
            placeholder={f}
            value={form[f]}
            onChange={handle}
            className="w-full mb-3 p-2 border rounded"
            required
          />
        ))}
        <button className="w-full py-2 bg-lavender text-white rounded">
          Create Account
        </button>
        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-lavender underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
