"use client";

/**
 * One shared SignalR connection to the .NET API's clinic hub, for the
 * screens where "did something change while I wasn't looking" is a real
 * problem — Staff Queue/Dashboard, Doctor Visits/Dashboard, Staff Payments.
 * Everything else stays request-based on purpose; pushing live updates to
 * screens nobody's staring at (settings, templates, patient records mid-edit)
 * would just be solving a problem that doesn't exist.
 *
 * Events broadcast by ClinicHub (Project02-be):
 *   - "PatientCheckedIn" { bookingId, doctorId, queueNumber, patientName, patientCode }
 *   - "QueueUpdated"     { bookingId, doctorId, status }
 *   - "PaymentUpdated"   { bookingId, paymentId, status }
 *
 * Group membership (server-assigned on connect, from the JWT): Admin/Staff
 * join "staff"; a Doctor joins "doctor:{doctorId}" for their own patients.
 * A component only ever needs to listen — no per-page group logic.
 */
import * as signalR from "@microsoft/signalr";
import { useEffect, useRef } from "react";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";

let connection: signalR.HubConnection | null = null;
let starting = false;
let retryAttempt = 0;

// withAutomaticReconnect() only covers a connection that was established and
// then dropped. It does nothing if the *initial* .start() call itself fails
// (cold backend start, a momentary network blip, a transient CORS/negotiate
// hiccup) — and it also gives up permanently after its own default retry
// window (0s/2s/10s/30s) elapses without reconnecting, leaving the
// connection in a plain Disconnected state forever. Both cases used to mean
// "no more real-time updates until the user happens to navigate away and
// back." This retry loop is the actual backstop: it keeps trying,
// indefinitely, capped at 30s between attempts, and picks the connection
// back up from onclose() too — so a page left open across a real network or
// backend outage recovers on its own once things come back, not on a whim.
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

function scheduleRetry() {
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  setTimeout(attemptStart, delay);
}

function attemptStart() {
  const conn = getConnection();
  if (starting || conn.state !== signalR.HubConnectionState.Disconnected) return;
  starting = true;
  conn
    .start()
    .then(() => {
      starting = false;
      retryAttempt = 0;
    })
    .catch(() => {
      starting = false;
      scheduleRetry();
    });
}

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/clinic`, {
        accessTokenFactory: async () => (await getAccessToken()) ?? "",
        // Auth here is the bearer token above, not the httpOnly session
        // cookie — the API's CORS policy doesn't set AllowCredentials, so
        // the client shouldn't request credentialed CORS either.
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    // Covers the case where SignalR's own automatic-reconnect exhausts its
    // attempts and permanently closes the connection — hand it back to our
    // retry loop instead of leaving it dead for the rest of the page's life.
    connection.onclose(() => scheduleRetry());
  }
  return connection;
}

/** Idempotent — safe to call from every component that wants the connection up. Fire-and-forget: the retry loop above is what actually guarantees forward progress, not this call's return value. */
function ensureStarted(): void {
  attemptStart();
}

export type ClinicHubEvent = "PatientCheckedIn" | "QueueUpdated" | "PaymentUpdated";

/**
 * Subscribe to one hub event for the lifetime of the component. On any of
 * these events the caller is expected to just refetch its own list — the
 * payload is a hint to refresh, not a patch to apply, so one handler shape
 * works everywhere without every screen re-deriving server state by hand.
 */
export function useClinicHubEvent(event: ClinicHubEvent, onEvent: () => void) {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    const conn = getConnection();
    const handler = () => handlerRef.current();
    conn.on(event, handler);
    // Fire-and-forget — the retry loop in ensureStarted keeps trying in the
    // background regardless of this call. Real-time is still a convenience
    // layer over the existing request-based data: every page that uses this
    // hook also has its own fallback poll, so a connection that's still
    // retrying doesn't mean the page shows stale data forever.
    ensureStarted();
    return () => {
      conn.off(event, handler);
    };
  }, [event]);
}
