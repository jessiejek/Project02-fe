#!/usr/bin/env node
/**
 * Dev-only. Mirrors rows from the Supabase project into the .NET DB (via
 * Project02-be POST /api/dev/import) with their original primary keys, so the
 * parity harness compares like-for-like during the migration.
 *
 *   node scripts/dev/import-from-supabase.mjs [table ...]
 *
 * No args = all supported tables in FK-safe order. `users`/`profiles` are NOT
 * imported — the .NET DevDataSeeder already creates them with matching ids.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS for a full read).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const API = (env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

// FK-safe order.
const ORDER = [
  "medicines",
  "vital_field_templates",
  "services",
  "staff_accounts",
  "patients",
  "doctors",
  "doctor_services",
  "doctor_schedules",
  "doctor_blocked_dates",
  "doctor_day_statuses",
  "bookings",
  "booking_services",
  "payments",
  "consultations",
  "consultation_diagnoses",
  "patient_vital_readings",
  "follow_ups",
  "prescription_groups",
  "prescription_line_items",
  "prescription_templates",
  "prescription_template_items",
  "doctor_favorite_medicines",
  "soap_templates",
  "soap_phrases",
];

const wanted = process.argv.slice(2);
const tables = wanted.length ? ORDER.filter((t) => wanted.includes(t)) : ORDER;

for (const table of tables) {
  const { data, error } = await sb.from(table).select("*");
  if (error) {
    console.error(`✗ ${table}: read failed — ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  const res = await fetch(`${API}/api/dev/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, rows: data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`✗ ${table}: import failed (${res.status}) — ${JSON.stringify(body)}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${table.padEnd(22)} read ${String(data.length).padStart(3)}  →  upserted ${body.upserted}`);
  }
}
