// JJQR - AI (Nov 20, 2026) - B-01: show the server's own validation sentence (400/403/409/422) instead of a vague "try again"
import { ApiError } from "./client";

/** The server's human message for a rejected request, or `fallback` for anything else (network, 500, generic "API 500"). */
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && [400, 403, 409, 422, 423, 429].includes(e.status)) {
    const m = e.message?.trim();
    if (m && !/^API \d+$/.test(m) && !/^(Bad Request|Forbidden|Conflict)$/i.test(m)) return m;
  }
  return fallback;
}
// JJQR - END
