import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Jobs from './pages/Jobs';
import AddJob from './pages/AddJob';
import { AuthContext } from './context/AuthContext';

function Private({ children }) {
  const { user } = React.useContext(AuthContext);
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-lavender">
      <Navbar />
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/add" element={<Private><AddJob /></Private>} />
        <Route path="*" element={<Navigate to="/jobs" />} />
      </Routes>
    </div>
  );
}