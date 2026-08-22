/* eslint-disable react-refresh/only-export-components */

import { createContext, useState, useEffect, useCallback } from "react";
import { getStoredAuth, setStoredAuth, clearStoredAuth, onUnauthorized } from "../services/api.js";

export const AuthContext = createContext();

/**
 * Phase 2B: now reflects real authentication state (a JWT + the user it
 * belongs to), persisted via services/api.js's storage helpers, instead
 * of only ever holding `{name, email}` with no token (the gap
 * FRONTEND_AUDIT.md §5 identified — every "authenticated" request the
 * old frontend made was actually unauthenticated in practice, since the
 * token was fetched on login and then discarded).
 *
 * Phase 2E audit note: this file was reviewed against this phase's full
 * requirement list and needed no changes. `getStoredAuth()` reads
 * `localStorage` synchronously, so authentication is already restored
 * before the very first render — there is no async initialization gap to
 * add a loading flag for. `login()`/`logout()` already do exactly what
 * this phase asks (store/clear the token, update React state), the
 * cross-tab `storage` listener and the same-tab `onUnauthorized` listener
 * (§ above) already implement "a 401 clears stale auth," and no
 * automatic token-renewal mechanism exists anywhere, per this phase's
 * explicit instruction not to add one (the backend contract doesn't
 * offer one).
 * No `signup` was added here: `authApi.signup()` returns only `{msg}`
 * (BACKEND_API_CONTRACT.md §1) — no token, so signup never changes
 * authenticated-vs-not state and has nothing for this context to do;
 * `Signup.jsx` calls the service directly, exactly as it already did.
 */
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => getStoredAuth());

  // Call after a successful login/signup-then-login with the real
  // `{token, user}` pair from authApi.login() — never with just a user
  // object, so a token can never be "forgotten" on the happy path again.
  const login = useCallback((token, user) => {
    setStoredAuth(token, user);
    setAuth({ token, user });
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  // Cross-tab sync — unchanged behavior from before this phase, just
  // re-reading the new combined {token,user} storage shape.
  useEffect(() => {
    const handleStorageChange = () => setAuth(getStoredAuth());
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Same-tab sync: when any authenticated request comes back 401 (e.g. an
  // expired token), the api.js response interceptor already cleared the
  // underlying storage — this clears the in-memory/React state to match,
  // so the UI reflects "logged out" immediately rather than only after a
  // manual refresh. No redirect happens here or in api.js.
  useEffect(() => onUnauthorized(() => setAuth(null)), []);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user ?? null,
        token: auth?.token ?? null,
        isAuthenticated: Boolean(auth?.token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
