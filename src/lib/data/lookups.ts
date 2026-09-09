/**
 * Clinical lookup tables (INTEGRATION_ROADMAP.md Phase 3): medicines,
 * vital_field_templates, icd10_codes. Read-only, canonical §4 shapes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

export interface MedicineRow {
  medicine_id: string;
  generic_name: string;
  created_at?: string;
}

export interface VitalFieldTemplateRow {
  template_id: string;
  description: string;
  form_key: string;
  unit: string;
  icon: string;
  is_default: boolean;
  created_at?: string;
}

export interface Icd10CodeRow {
  code: string;
  description: string;
}

export interface LabTestRow {
  lab_test_id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at?: string;
}

export async function queryMedicines(supabase: SupabaseClient): Promise<MedicineRow[]> {
  if (resolveMode("medicines") === "dotnet") {
    return api.get<MedicineRow[]>("/api/medicines", { anonymous: true });
  }
  const { data } = await supabase.from("medicines").select("*").order("generic_name");
  return (data ?? []) as MedicineRow[];
}

export async function queryVitalFieldTemplates(
  supabase: SupabaseClient,
): Promise<VitalFieldTemplateRow[]> {
  if (resolveMode("vital_field_templates") === "dotnet") {
    return api.get<VitalFieldTemplateRow[]>("/api/vital-field-templates", { anonymous: true });
  }
  const { data } = await supabase.from("vital_field_templates").select("*").order("description");
  return (data ?? []) as VitalFieldTemplateRow[];
}

/**
 * §16.8 Form 3 — the clinic's fixed lab-request panel. .NET-only (no Supabase
 * table); resolves via the `medical_certificates`/labs migration data.
 */
export async function queryLabTestCatalog(_supabase: SupabaseClient): Promise<LabTestRow[]> {
  return api.get<LabTestRow[]>("/api/lab-test-catalog", { anonymous: true });
}

export async function queryIcd10Codes(
  supabase: SupabaseClient,
  q?: string,
): Promise<Icd10CodeRow[]> {
  if (resolveMode("icd10_codes") === "dotnet") {
    return api.get<Icd10CodeRow[]>("/api/icd10-codes", {
      anonymous: true,
      query: q ? { q } : undefined,
    });
  }
  let query = supabase.from("icd10_codes").select("*").order("code").limit(50);
  if (q) query = query.or(`code.ilike.%${q}%,description.ilike.%${q}%`);
  const { data } = await query;
  return (data ?? []) as Icd10CodeRow[];
}
