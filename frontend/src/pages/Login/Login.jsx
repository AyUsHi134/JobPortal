// src/pages/Login/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Login.scss";
import eyeIcon from "../../assets/eye.png";
import eyeOffIcon from "../../assets/eye-off.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        login(data.user);
        navigate("/profile");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong");
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Login</h2>
        {error && <p className="error">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <img
            src={showPassword ? eyeOffIcon : eyeIcon}
            alt="Toggle visibility"
            className="toggle-password"
            onClick={() => setShowPassword((prev) => !prev)}
          />
        </div>

        <button type="submit">Login</button>

        <div className="login-links">
          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
          <p>
            Don’t have an account?{" "}
            <Link to="/signup" className="signup-link">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
