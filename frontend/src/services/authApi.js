import { apiClient } from "./api.js";

/** Signup and login calls only */

export async function login(email, password) {
  const { data } = await apiClient.post("/api/auth/login", { email, password });
  // Returns token and user
  return data;
}

export async function signup(name, email, password) {
  const { data } = await apiClient.post("/api/auth/signup", { name, email, password });
  // Returns success message
  return data;
}
