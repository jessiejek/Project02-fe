// Source guards (P0.3 + P0.4): fail the build if a client-side patient-code generator or a
// UTC-derived "today" creeps back into production code. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = new URL("..", import.meta.url).pathname; // .../src/
const ROOT = join(SRC, "..");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

// Production sources: everything under src/ except the legacy mock/type dumps.
const files = walk(SRC).filter((f) => {
  const rel = relative(SRC, f).split(sep).join("/");
  return !rel.startsWith("data/");
});
const rel = (f) => relative(ROOT, f).split(sep).join("/");
const read = (f) => readFileSync(f, "utf8");

test("scanner sees the production source tree", () => {
  assert.ok(files.length > 100, `only found ${files.length} files`);
  assert.ok(statSync(join(SRC, "lib", "clock.ts")).isFile());
});

test("P0.4: no UTC-derived date (toISOString().slice/split/substring) outside lib/clock.ts", () => {
  const re = /toISOString\(\)\s*\.\s*(slice|substring|substr|split)\s*\(/;
  const offenders = files
    .filter((f) => !f.endsWith(`${sep}lib${sep}clock.ts`))
    .flatMap((f) =>
      read(f)
        .split("\n")
        .map((line, i) => (re.test(line) ? `${rel(f)}:${i + 1}: ${line.trim()}` : null))
        .filter(Boolean),
    );
  assert.deepEqual(offenders, [], `Use todayManila()/addDaysToDate() from @/lib/clock:\n${offenders.join("\n")}`);
});

test("P0.3: no client-side patient_code generation", () => {
  const offenders = [];
  for (const f of files) {
    const text = read(f);
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("{/*")) return;
      // a code literal / template, e.g. `MF-${...}` or "MF-1234"
      if (/["'`]MF-/.test(line)) offenders.push(`${rel(f)}:${i + 1}: builds an MF- code: ${trimmed}`);
      // random numbers on the same statement as a patient code
      if (/patient_?code/i.test(line) && /Math\.random|crypto\.random|uuid/i.test(line))
        offenders.push(`${rel(f)}:${i + 1}: random patient code: ${trimmed}`);
    });
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("P0.3: createPatient does not send a patient_code — the API issues it", () => {
  const src = read(join(SRC, "lib", "data", "patients.ts"));
  const fn = src.slice(src.indexOf("export async function createPatient"));
  const body = fn.slice(0, fn.indexOf("\n}\n") + 3);
  assert.ok(body.includes('api.post<PatientRow>("/api/patients"'), "createPatient no longer posts to /api/patients?");
  assert.ok(!/patient_code/.test(body.replace(/\/\/.*$/gm, "")), "createPatient must not build or send patient_code");
});

test("P0.3: no caller passes a patient_code into createPatient", () => {
  const offenders = [];
  for (const f of files) {
    const text = read(f);
    for (const m of text.matchAll(/createPatient\s*\(([\s\S]*?)\)\s*;?/g)) {
      if (/patient_?code/i.test(m[1])) offenders.push(rel(f));
    }
  }
  assert.deepEqual(offenders, []);
});
