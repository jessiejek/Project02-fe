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

/** For non-fetch consumers (the SignalR hub connection) that need the same
 * access token this client attaches as `Authorization: Bearer`. */
export async function getAccessToken(): Promise<string | undefined> {
  return tokenProvider();
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

//JJQR - AI (Nov 22, 2026) - stale-form protection. While a visit page is open, the server's "visit version" (X-Visit-Version) is remembered and sent with every save
// of that visit (consultation, vitals, prescriptions, labs, follow-up, diagnoses). If the visit was changed on another computer or window the server answers 409 "visit_changed"
// and nothing is overwritten. Saves of one visit also run one at a time so two of our own saves cannot trip the check. Outside an open visit page nothing changes.
type VisitSession = { version?: string };
const visitSessions = new Map<string, VisitSession>();
const consultationToBooking = new Map<string, string>();
const visitWriteQueues = new Map<string, Promise<unknown>>();

/** Call when a visit page opens; call endVisitSession when it closes. */
export function beginVisitSession(bookingId: string) {
  visitSessions.set(bookingId, {});
  visitWriteQueues.delete(bookingId);
}
export function endVisitSession(bookingId: string) {
  visitSessions.delete(bookingId);
  visitWriteQueues.delete(bookingId);
}

const GUID = "[0-9a-fA-F-]{36}";
const RE_BY_BOOKING = new RegExp(`^/api/(?:consultations|vitals|prescription-groups|lab-orders)/by-booking/(${GUID})/?$`);
const RE_DIAGNOSES = new RegExp(`^/api/consultations/(${GUID})/diagnoses/?$`);
const RE_BY_CONSULTATION = new RegExp(`^/api/(?:lab-orders|follow-ups)/by-consultation/(${GUID})/?$`);

function visitBookingFor(path: string, query?: RequestOptions["query"]): string | undefined {
  if (visitSessions.size === 0) return undefined;
  const bare = path.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  const m1 = RE_BY_BOOKING.exec(bare);
  if (m1) return visitSessions.has(m1[1]) ? m1[1] : undefined;
  const m2 = RE_DIAGNOSES.exec(bare) ?? RE_BY_CONSULTATION.exec(bare);
  if (m2) {
    const b = consultationToBooking.get(m2[1]);
    return b && visitSessions.has(b) ? b : undefined;
  }
  if (["/api/vitals", "/api/prescription-groups", "/api/consultations"].includes(bare)) {
    const b = query?.bookingId ? String(query.bookingId) : /[?&]bookingId=([^&]+)/.exec(path)?.[1];
    return b && visitSessions.has(b) ? b : undefined;
  }
  return undefined;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const bookingId = visitBookingFor(path, opts.query);
  const isWrite = method === "PUT" || method === "DELETE";
  if (bookingId && isWrite) {
    const previous = visitWriteQueues.get(bookingId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => requestOnce<T>(method, path, body, opts, bookingId));
    visitWriteQueues.set(bookingId, run);
    return run;
  }
  return requestOnce<T>(method, path, body, opts, bookingId);
}
//JJQR - END

async function requestOnce<T>(
  method: string,
  path: string,
  body: unknown,
  opts: RequestOptions,
  visitBookingId?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  //JJQR - AI (Nov 22, 2026) - send the version this page last saw (writes only)
  const session = visitBookingId ? visitSessions.get(visitBookingId) : undefined;
  if (session?.version && (method === "PUT" || method === "DELETE")) headers["X-Visit-Version"] = session.version;
  //JJQR - END

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

  //JJQR - AI (Nov 22, 2026) - remember the visit version the server reports
  if (visitBookingId && session) {
    const v = res.headers.get("X-Visit-Version");
    const cons = res.headers.get("X-Visit-Consultation");
    const booking = res.headers.get("X-Visit-Booking");
    if (cons && booking) consultationToBooking.set(cons, booking);
    if (v) {
      const isWrite = method === "PUT" || method === "DELETE";
      if (isWrite && res.ok) session.version = v; // our own save: the visit is now exactly what we saved
      else if (!isWrite && session.version === undefined && (res.ok || res.status === 404)) session.version = v; // first read of this visit
      // a refused (409) save keeps the old version, so nothing can be saved until the page reloads
    }
  } else if (visitSessions.size > 0 && res.ok && (method === "PUT" || method === "DELETE")) {
    // a save of this visit through a route the client could not map (e.g. DELETE /prescription-groups/{id}): keep our version in step with it
    const booking = res.headers.get("X-Visit-Booking");
    const v = res.headers.get("X-Visit-Version");
    const sess = booking ? visitSessions.get(booking) : undefined;
    if (sess && v) sess.version = v;
  }
  //JJQR - END
  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;

  if (res.status === 409 && typeof window !== "undefined" && parsed && typeof parsed === "object" && (parsed as { code?: string }).code === "visit_changed") {
    //JJQR - AI (Nov 22, 2026) - tell the open visit page, so it can say plainly that the visit changed elsewhere and must be reloaded (the save-specific messages only say "try again")
    window.dispatchEvent(new CustomEvent("clinic:visit-changed", { detail: { bookingId: visitBookingId ?? res.headers.get("X-Visit-Booking"), message: (parsed as { message?: string }).message } }));
    //JJQR - END
  }
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
