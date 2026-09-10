"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionInfo } from "@/lib/auth/types";

export type { SessionInfo };

const SessionContext = createContext<{ session: SessionInfo | null; loading: boolean }>({
  session: null,
  loading: true,
});

// `initialSession` is computed on the server from the .NET JWT cookie (see
// src/lib/auth/session.ts) and passed straight through — no client-side auth
// call. Fetched once at the root layout, which persists across client-side
// navigations, so every page's AppShell/Topbar reads it via useSession().
export function SessionProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: SessionInfo | null;
}) {
  const [session, setSession] = useState<SessionInfo | null>(initialSession);

  // Keep in sync when the server re-resolves it (e.g. after router.refresh()).
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  return <SessionContext.Provider value={{ session, loading: false }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
