import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [{ data: profiles, error: profilesError }, { data: staff, error: staffError }, { data: patients, error: patientsError }] =
  await Promise.all([
    supabase.from("profiles").select("id, role, created_at").order("created_at", { ascending: true }),
    supabase.from("staff_accounts").select("staff_id, full_name, email, role, status, user_id").order("full_name"),
    supabase
      .from("patients")
      .select("patient_id, patient_code, first_name, last_name, email, user_id, is_guest")
      .order("created_at", { ascending: true }),
  ]);

if (profilesError) console.error("profiles error:", profilesError.message);
if (staffError) console.error("staff error:", staffError.message);
if (patientsError) console.error("patients error:", patientsError.message);

const authUsers = [];
let page = 1;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("auth.admin.listUsers error:", error.message);
    break;
  }
  authUsers.push(...(data?.users ?? []));
  if (!data?.users?.length || data.users.length < 200) break;
  page += 1;
}

const emailByUserId = new Map(authUsers.map((u) => [u.id, u.email ?? "(no email)"]));

console.log("=== AUTH USERS (login emails) ===");
for (const u of authUsers) {
  const profile = (profiles ?? []).find((p) => p.id === u.id);
  console.log(`- ${u.email ?? "(no email)"} | role=${profile?.role ?? "NO PROFILE"} | id=${u.id}`);
}

console.log("\n=== STAFF ACCOUNTS ===");
for (const s of staff ?? []) {
  console.log(
    `- ${s.email} | ${s.full_name} | role=${s.role} | status=${s.status} | linked=${s.user_id ? "yes" : "no"}`,
  );
}

console.log("\n=== PATIENTS WITH PORTAL (user_id set) ===");
for (const p of patients ?? []) {
  if (!p.user_id) continue;
  console.log(
    `- ${p.email || emailByUserId.get(p.user_id) || "(no email)"} | ${p.first_name} ${p.last_name} | code=${p.patient_code}`,
  );
}

console.log("\n=== GUEST / UNLINKED PATIENTS (cannot login) ===");
const guests = (patients ?? []).filter((p) => !p.user_id);
console.log(`count=${guests.length}`);
for (const p of guests.slice(0, 20)) {
  console.log(`- ${p.email || "(blank email)"} | ${p.first_name} ${p.last_name} | code=${p.patient_code} | guest=${p.is_guest}`);
}
if (guests.length > 20) console.log(`... and ${guests.length - 20} more`);

console.log("\nNote: passwords are NOT stored in the database in readable form.");
console.log("If you do not remember them, reset via /forgot-password or Supabase Auth dashboard.");
