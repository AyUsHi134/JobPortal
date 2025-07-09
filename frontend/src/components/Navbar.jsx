import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();

  return (
    <nav className="bg-card-bg shadow p-4 flex justify-between">
      <div className="text-xl font-bold text-lavender">Jobify</div>
      <div className="space-x-4">
        <Link to="/jobs" className="hover:text-lavender">Jobs</Link>
        {user ? (
          <>
            <Link to="/add" className="hover:text-lavender">Add Job</Link>
            <button onClick={() => { logout(); nav('/login'); }} className="hover:text-red-500">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-lavender">Login</Link>
            <Link to="/signup" className="hover:text-lavender">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}