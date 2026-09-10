/**
 * Clinical lookup tables: medicines, vital_field_templates, icd10_codes,
 * lab_test_catalog. Read-only, canonical §4 shapes, served by the .NET API.
 *
 * The leading `_supabase` parameter is a migration vestige (callers pass
 * `null as never`) — kept only to avoid churning every call site.
 */
import { api } from "@/lib/api/client";

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

export async function queryMedicines(_supabase?: unknown): Promise<MedicineRow[]> {
  return api.get<MedicineRow[]>("/api/medicines", { anonymous: true });
}

export async function queryVitalFieldTemplates(_supabase?: unknown): Promise<VitalFieldTemplateRow[]> {
  return api.get<VitalFieldTemplateRow[]>("/api/vital-field-templates", { anonymous: true });
}

/** §16.8 Form 3 — the clinic's fixed lab-request panel. */
export async function queryLabTestCatalog(_supabase?: unknown): Promise<LabTestRow[]> {
  return api.get<LabTestRow[]>("/api/lab-test-catalog", { anonymous: true });
}

export async function queryIcd10Codes(_supabase: unknown, q?: string): Promise<Icd10CodeRow[]> {
  return api.get<Icd10CodeRow[]>("/api/icd10-codes", {
    anonymous: true,
    query: q ? { q } : undefined,
  });
}
