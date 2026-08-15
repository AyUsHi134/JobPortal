/* eslint-disable react-refresh/only-export-components */

import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext(); 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const localUser = localStorage.getItem("jobportal_user");
    return localUser ? JSON.parse(localUser) : null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("jobportal_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("jobportal_user");
  };

  // ✅ Sync logout across browser tabs
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem("jobportal_user");
      setUser(storedUser ? JSON.parse(storedUser) : null);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

