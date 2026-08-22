import { apiClient } from "./api.js";

/**
 * Signup/login network calls only — per BACKEND_API_CONTRACT.md §1.
 * Deliberately do NOT touch storage or React state here (that's
 * AuthContext's job, so these functions stay reusable/testable
 * independent of any page): callers receive the parsed response and
 * decide what to do with it.
 */

export async function login(email, password) {
  const { data } = await apiClient.post("/api/auth/login", { email, password });
  // { token, user: { name, email } } — see BACKEND_API_CONTRACT.md §1.
  return data;
}

export async function signup(name, email, password) {
  const { data } = await apiClient.post("/api/auth/signup", { name, email, password });
  // { msg: "User created" } — see BACKEND_API_CONTRACT.md §1.
  return data;
}
