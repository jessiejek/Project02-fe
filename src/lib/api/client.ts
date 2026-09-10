/**
 * Typed fetch client for the .NET API (Project02-be). Every `src/lib/data/*`
 * module routes through here; there is no other backend.
 *
 * Wire format: data resources are snake_case (DOTNET_FRONTEND_CONTRACT.md §4/§6);
 * the /api/auth/* layer is camelCase. Callers get the JSON verbatim — no casing
 * transform happens here.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API ${status}`);
    this.name = "ApiError";
  }
}

/** Supplies the access token for Authorization. */
export type TokenProvider = () => string | undefined | Promise<string | undefined>;

let tokenProvider: TokenProvider = defaultBrowserTokenProvider;

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

// The access token lives in an httpOnly cookie (clinic_at). On the server we
// read it directly; in the browser we fetch it from the same-origin
// /api/session/token route. Cached for a minute; a 401 from a real API call
// clears it via clearCachedToken().
let cachedToken: { value: string; at: number } | undefined;

async function defaultBrowserTokenProvider(): Promise<string | undefined> {
  // Server (RSC / route handlers): read the httpOnly cookie directly.
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      return (await cookies()).get("clinic_at")?.value;
    } catch {
      return undefined; // outside a request scope (e.g. build)
    }
  }

  // Browser: the token lives in an httpOnly cookie — fetch it from same-origin.
  if (cachedToken && Date.now() - cachedToken.at < 60_000) return cachedToken.value;
  try {
    const res = await fetch("/api/session/token", { cache: "no-store" });
    if (!res.ok) return undefined;
    const { token } = (await res.json()) as { token?: string };
    if (token) cachedToken = { value: token, at: Date.now() };
    return token;
  } catch {
    return undefined;
  }
}

export function clearCachedToken() {
  cachedToken = undefined;
}

type RequestOptions = {
  /** Extra query params; undefined/null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the Authorization header (e.g. public GET /api/doctors). */
  anonymous?: boolean;
  headers?: Record<string, string>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (!opts.anonymous) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    signal: opts.signal,
    cache: "no-store",
  });

  // Stale cached browser token → refetch once and retry.
  if (res.status === 401 && !opts.anonymous && typeof window !== "undefined") {
    clearCachedToken();
    const fresh = await tokenProvider();
    if (fresh) {
      headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(buildUrl(path, opts.query), {
        method,
        headers,
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
        signal: opts.signal,
        cache: "no-store",
      });
    }
  }

  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, parsed ?? text, extractMessage(parsed) ?? res.statusText);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    if (typeof b.error === "string") return b.error;
    if (typeof b.title === "string") return b.title;
  }
  return undefined;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, undefined, opts),
};
