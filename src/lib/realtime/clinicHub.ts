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
let startPromise: Promise<void> | null = null;

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
  }
  return connection;
}

/** Idempotent — safe to call from every component that wants the connection up. */
function ensureStarted(): Promise<void> {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Connected) return Promise.resolve();
  if (!startPromise) {
    startPromise = conn.start().catch((err) => {
      startPromise = null; // let the next mount retry instead of wedging forever
      throw err;
    });
  }
  return startPromise;
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
    ensureStarted().catch(() => {
      // Real-time is a convenience layer over the existing request-based
      // data — a doctor/staff dashboard that never gets a live push still
      // works correctly on its own manual refresh and periodic reloads.
    });
    return () => {
      conn.off(event, handler);
    };
  }, [event]);
}
