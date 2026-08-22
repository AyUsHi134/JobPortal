import { Link } from "react-router-dom";
import "./AuthRequired.scss";

// Phase 2E: a small, reused "you need to log in" view for the frontend's
// protected pages (Profile, Saved Jobs, Add Job). Not a routing guard —
// there is no redirect/wrapper-route mechanism here, just a fallback
// rendered in place of the real page content when `useAuth().isAuthenticated`
// is false, so a click on a protected action never fires a request that's
// guaranteed to fail with a 401. The backend remains the actual security
// boundary (BACKEND_API_CONTRACT.md §1) — this is purely a frontend UX
// improvement over letting a protected request fail silently/confusingly.
export default function AuthRequired({ message = "You need to be logged in to view this page." }) {
  return (
    <div className="auth-required">
      <h2>Login required</h2>
      <p>{message}</p>
      <Link to="/login" className="auth-required__login-link">Log in</Link>
    </div>
  );
}
