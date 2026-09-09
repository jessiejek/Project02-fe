#!/usr/bin/env node
/**
 * Parity harness — diff Supabase vs .NET JSON for one case.
 *   node scripts/parity/run.mjs <case-name> [--keep-timestamps]
 *
 * Cases: scripts/parity/cases/<name>.mjs  →  export { supabase, dotnet, key?, volatileKeys? }
 * Exit non-zero on any difference (CI gate).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [caseName, ...flags] = process.argv.slice(2);
if (!caseName) {
  console.error("usage: node scripts/parity/run.mjs <case-name> [--keep-timestamps]");
  process.exit(2);
}
const keepTimestamps = flags.includes("--keep-timestamps");

// --- env (read .env.local without a dep) ---
const env = Object.fromEntries(
  readFileSync(join(__dirname, "../../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

// Prefer the service-role key: parity is about data correctness, not RLS
// behaviour. (Falls back to anon if the service key isn't set.)
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const API_BASE = (env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
const api = {
  get: async (path) => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
    return res.json();
  },
};

const mod = await import(join(__dirname, "cases", `${caseName}.mjs`));
const keyFn = mod.key ?? ((r) => r.id ?? r[Object.keys(r).find((k) => k.endsWith("_id"))]);
const volatile = new Set(
  keepTimestamps ? [] : ["created_at", "updated_at", ...(mod.volatileKeys ?? [])],
);

const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !volatile.has(k))
        .map(([k, val]) => [k, strip(val)]),
    );
  }
  return v;
};
const normalize = (rows) =>
  strip([...rows].sort((a, b) => String(keyFn(a)).localeCompare(String(keyFn(b)))));

const [sbRows, netRows] = await Promise.all([mod.supabase(sb), mod.dotnet(api)]);
const a = JSON.stringify(normalize(sbRows), null, 2);
const b = JSON.stringify(normalize(netRows), null, 2);

if (a === b) {
  console.log(`✓ parity OK: ${caseName} (${sbRows.length} rows)`);
  process.exit(0);
}

console.log(`✗ parity DIFF: ${caseName}\n  supabase=${sbRows.length} rows  dotnet=${netRows.length} rows\n`);
const al = a.split("\n");
const bl = b.split("\n");
for (let i = 0; i < Math.max(al.length, bl.length); i++) {
  if (al[i] !== bl[i]) {
    if (al[i] !== undefined) console.log(`  - ${al[i]}`);
    if (bl[i] !== undefined) console.log(`  + ${bl[i]}`);
  }
}
process.exit(1);
