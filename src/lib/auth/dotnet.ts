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
  } catch (e) {
    // TEMP DEBUG — remove once the deploy issue is found. Surfaces the actual
    // fetch failure (and what URL it tried) straight in the response body so
    // it's curl-able without needing the Vercel log viewer.
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    console.error("dotnetAuth fetch failed", { url: `${API_BASE_URL}${path}`, error: e });
    return {
      ok: false,
      status: 0,
      message: `[debug] fetch to ${API_BASE_URL}${path} failed: ${err?.message ?? String(e)}` +
        (err?.cause ? ` | cause: ${err.cause.code ?? ""} ${err.cause.message ?? ""}` : ""),
    };
  }
  const text = await res.text();
  const json = text ? safeParse(text) : undefined;
  if (!res.ok) {
    let message = "Authentication failed.";
    if (json && typeof json === "object" && "message" in json) {
      const m = (json as Record<string, unknown>).message;
      if (typeof m === "string" && m) message = m;
    }
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: json as T };
}

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export const dotnetAuth = {
  login: (email: string, password: string) => post<DotnetSession>("/api/auth/login", { email, password }),
  refresh: (refreshToken: string) =>
    post<{ accessToken: string; refreshToken: string }>("/api/auth/refresh-token", { refreshToken }),
  logout: (refreshToken: string) => post<unknown>("/api/auth/logout", { refreshToken }),
};
