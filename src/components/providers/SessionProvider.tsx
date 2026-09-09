"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTH_MODE } from "@/lib/auth/mode";
import type { SessionInfo } from "@/lib/auth/types";

export type { SessionInfo };

const SessionContext = createContext<{ session: SessionInfo | null; loading: boolean }>({
  session: null,
  loading: true,
});

// Fetched once here at the root layout, which persists across client-side
// navigations in the App Router — every page's AppShell/Topbar reads this via
// useSession() instead of each re-fetching the same "who's logged in" query.
//
// AUTH_MODE=dotnet: `initialSession` is computed on the server from the .NET JWT
// cookie (see src/lib/auth/session.ts) and passed straight through — no
// client-side auth call. AUTH_MODE=supabase: unchanged — loaded here from the
// Supabase client.
export function SessionProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: SessionInfo | null;
}) {
  const [session, setSession] = useState<SessionInfo | null>(initialSession);
  const [loading, setLoading] = useState(AUTH_MODE !== "dotnet");

  useEffect(() => {
    if (AUTH_MODE === "dotnet") {
      // Server already resolved it; keep in sync on prop change (e.g. router.refresh()).
      setSession(initialSession);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function loadSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile) {
        setSession(null);
        setLoading(false);
        return;
      }

      if (profile.role === "Patient") {
        const { data: patient } = await supabase
          .from("patients")
          .select("patient_id, first_name, last_name")
          .eq("user_id", user.id)
          .single();
        setSession({
          userId: user.id,
          role: "Patient",
          displayName: patient ? `${patient.first_name} ${patient.last_name}` : user.email ?? "Patient",
          avatarUrl: null,
          staffId: null,
          patientId: patient?.patient_id ?? null,
        });
      } else {
        const { data: staff } = await supabase
          .from("staff_accounts")
          .select("staff_id, full_name, avatar_url")
          .eq("user_id", user.id)
          .single();
        setSession({
          userId: user.id,
          role: profile.role as "Staff" | "Doctor" | "Admin",
          displayName: staff?.full_name ?? user.email ?? profile.role,
          avatarUrl: staff?.avatar_url ?? null,
          staffId: staff?.staff_id ?? null,
          patientId: null,
        });
      }
      setLoading(false);
    }

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadSession();
    });
    return () => subscription.subscription.unsubscribe();
  }, [initialSession]);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
