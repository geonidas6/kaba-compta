import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fazgom_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fmtFCFA = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  ) + " FCFA";
