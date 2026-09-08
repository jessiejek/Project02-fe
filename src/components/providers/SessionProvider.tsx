"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionInfo {
  userId: string;
  role: "Patient" | "Staff" | "Doctor" | "Admin";
  displayName: string;
  avatarUrl: string | null;
  /** staff_accounts.staff_id — also doctors.doctor_id 1:1 when role is Doctor. Only set for Staff/Doctor/Admin. */
  staffId: string | null;
  /** patients.patient_id. Only set for Patient. */
  patientId: string | null;
}

const SessionContext = createContext<{ session: SessionInfo | null; loading: boolean }>({
  session: null,
  loading: true,
});

// Fetched once here at the root layout, which persists across client-side
// navigations in the App Router — every page's AppShell/Topbar reads this via
// useSession() instead of each re-fetching the same "who's logged in" query.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
