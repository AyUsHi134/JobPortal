// src/pages/Login/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { login as loginRequest } from "../../services/authApi.js";
import "./Login.scss";
import eyeIcon from "../../assets/eye.png";
import eyeOffIcon from "../../assets/eye-off.png";

// UI polish, same request handling
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const { token, user } = await loginRequest(email, password);
      login(token, user);
      navigate(location.state?.from || "/profile");
    } catch (err) {
      // err message already safe
      setError(err.message || "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin} noValidate>
        <h2>Login</h2>
        {error && <p className="error" role="alert">{error}</p>}

        <label className="field-label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="field-label" htmlFor="login-password">Password</label>
        <div className="password-wrapper">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            <img src={showPassword ? eyeOffIcon : eyeIcon} alt="" aria-hidden="true" />
          </button>
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        <div className="login-links">
          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
          <p>
            Don’t have an account?{" "}
            <Link to="/signup" state={{ from: location.state?.from }} className="signup-link">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
