/**
 * doctor_services reads (INTEGRATION_ROADMAP.md Phase 2).
 * Canonical §4/§6 shape: row + nested `services(name, category, price)`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { one } from "@/lib/one";
import { resolveMode } from "./mode";

export interface DoctorServiceRow {
  doctor_id: string;
  service_id: string;
  duration_minutes: number;
  services: { name: string | null; category: string | null; price: number | null } | null;
}

const dotnet = () => resolveMode("doctor_services") === "dotnet";

function project(raw: Record<string, unknown>): DoctorServiceRow {
  const s = one(raw.services as Record<string, unknown> | Record<string, unknown>[] | null);
  return {
    doctor_id: String(raw.doctor_id ?? ""),
    service_id: String(raw.service_id ?? ""),
    duration_minutes: Number(raw.duration_minutes ?? 0),
    services: s
      ? {
          name: (s.name as string) ?? null,
          category: (s.category as string) ?? null,
          price: s.price == null ? null : Number(s.price),
        }
      : null,
  };
}

export async function queryDoctorServices(
  supabase: SupabaseClient,
  opts: { doctorId?: string } = {},
): Promise<DoctorServiceRow[]> {
  if (dotnet()) {
    const rows = await api.get<Record<string, unknown>[]>("/api/doctor-services", {
      anonymous: true,
      query: opts.doctorId ? { doctorId: opts.doctorId } : undefined,
    });
    return rows.map(project);
  }
  let q = supabase
    .from("doctor_services")
    .select("doctor_id, service_id, duration_minutes, services(name, category, price)");
  if (opts.doctorId) q = q.eq("doctor_id", opts.doctorId);
  const { data } = await q;
  return (data ?? []).map((r) => project(r as Record<string, unknown>));
}
