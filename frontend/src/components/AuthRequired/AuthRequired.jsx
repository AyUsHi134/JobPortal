import { Link, useLocation } from "react-router-dom";
import "./AuthRequired.scss";

// Login-required fallback for protected pages
export default function AuthRequired({ message = "You need to be logged in to view this page." }) {
  const location = useLocation();
  return (
    <div className="auth-required">
      <h2>Login required</h2>
      <p>{message}</p>
      <Link to="/login" state={{ from: location.pathname + location.search }} className="auth-required__login-link">Log in</Link>
    </div>
  );
}
