import React, { useState, useContext } from 'react';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useContext(AuthContext);
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    const data = await api('/api/auth/login', {
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
        <h2 className="text-2xl mb-4">Log in</h2>
        {['email', 'password'].map(f => (
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
          Log In
        </button>
        <p className="mt-4 text-sm">
          Don’t have an account?{' '}
          <Link to="/signup" className="text-lavender underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
