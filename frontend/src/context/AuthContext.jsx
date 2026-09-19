/* eslint-disable react-refresh/only-export-components */

import { createContext, useState, useEffect, useCallback } from "react";
import { getStoredAuth, setStoredAuth, clearStoredAuth, onUnauthorized } from "../services/api.js";

export const AuthContext = createContext();

/** Real auth state, persisted */
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => getStoredAuth());

  // Call with real token, user
  const login = useCallback((token, user) => {
    setStoredAuth(token, user);
    setAuth({ token, user });
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = () => setAuth(getStoredAuth());
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Same-tab sync on 401
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
