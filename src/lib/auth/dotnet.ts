/**
 * Thin client for Project02-be /api/auth/* (camelCase wire — see the backend's
 * ClinicApp.Auth/Dtos.cs). Used only by the session route handlers and proxy.
 */
import { API_BASE_URL } from "@/lib/api/client";

export interface DotnetAuthUser {
  id: string;
  fullName: string;
  email: string;
  role: "Patient" | "Staff" | "Doctor" | "Admin";
  avatarUrl: string | null;
  isFirstLogin: boolean;
  phoneNumber: string | null;
}

export interface DotnetSession {
  accessToken: string;
  refreshToken: string;
  user: DotnetAuthUser;
}

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, message: "Could not reach the authentication server." };
  }
  const text = await res.text();
  const json = text ? safeParse(text) : undefined;
  if (!res.ok) {
    return { ok: false, status: res.status, message: errorMessage(json, res.status) };
  }
  return { ok: true, data: json as T };
}

/** Backend `{ message }`, ASP.NET ProblemDetails (`detail` / first validation error), else a
 *  status-specific fallback — a bare status-less "failed" hides whether the API is down,
 *  something else is answering on the port, or the request was rejected. */
function errorMessage(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const j = json as Record<string, unknown>;
    if (typeof j.message === "string" && j.message) return j.message;
    if (j.errors && typeof j.errors === "object") {
      const first = Object.values(j.errors as Record<string, unknown>).flat()[0];
      if (typeof first === "string" && first) return first;
    }
    if (typeof j.detail === "string" && j.detail) return j.detail;
    if (typeof j.title === "string" && j.title) return j.title;
  }
  if (status === 403 || status === 404 || status === 502 || status === 503)
    return `The server did not respond correctly (HTTP ${status}). Check that the clinic backend is running.`;
  return `Request failed (HTTP ${status}).`;
}

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export interface RegisterPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string; // yyyy-MM-dd
  sex: "Male" | "Female";
  contactNumber?: string;
}

export const dotnetAuth = {
  login: (email: string, password: string) => post<DotnetSession>("/api/auth/login", { email, password }),
  register: (payload: RegisterPayload) => post<DotnetSession>("/api/auth/register", payload),
  refresh: (refreshToken: string) =>
    post<{ accessToken: string; refreshToken: string }>("/api/auth/refresh-token", { refreshToken }),
  logout: (refreshToken: string) => post<unknown>("/api/auth/logout", { refreshToken }),
};
