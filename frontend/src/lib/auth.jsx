import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("fazgom_token");
    setImpersonating(!!localStorage.getItem("fazgom_admin_token"));
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("fazgom_token");
        localStorage.removeItem("fazgom_admin_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, u) => {
    localStorage.setItem("fazgom_token", token);
    localStorage.removeItem("fazgom_admin_token");
    setImpersonating(false);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("fazgom_token");
    localStorage.removeItem("fazgom_admin_token");
    setImpersonating(false);
    setUser(null);
  };

  const refresh = async () => {
    const r = await api.get("/auth/me");
    setUser(r.data);
    return r.data;
  };

  const startImpersonation = (newToken, newUser) => {
    const current = localStorage.getItem("fazgom_token");
    if (current) localStorage.setItem("fazgom_admin_token", current);
    localStorage.setItem("fazgom_token", newToken);
    setImpersonating(true);
    setUser(newUser);
  };

  const endImpersonation = async () => {
    const adminToken = localStorage.getItem("fazgom_admin_token");
    if (!adminToken) return null;
    localStorage.setItem("fazgom_token", adminToken);
    localStorage.removeItem("fazgom_admin_token");
    setImpersonating(false);
    const r = await api.get("/auth/me");
    setUser(r.data);
    return r.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        impersonating,
        login,
        logout,
        refresh,
        setUser,
        startImpersonation,
        endImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
