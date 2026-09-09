# Parity harness

Per phase of the Supabase → .NET migration (`../../Project02-be/INTEGRATION_ROADMAP.md`),
for a given query hit **both** backends and deep-diff the JSON. A resource is not
"flipped" in `src/lib/data/mode.ts` until its diff is empty, or every delta is
explained in the phase PR.

## Usage

```bash
# Both backends must be running and pointed at the SAME seeded database's data.
#   Supabase:  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY  (.env.local)
#   .NET:      NEXT_PUBLIC_API_URL (default http://localhost:5000), started from Project02-be

node scripts/parity/run.mjs doctors
node scripts/parity/run.mjs services
```

Each case lives in `cases/<name>.mjs` and exports `{ supabase, dotnet, key? }`:

- `supabase(sb)` — runs the Supabase query, returns rows
- `dotnet(api)`  — runs the .NET call, returns rows
- `key(row)`     — optional stable identity for order-independent diffing
                   (defaults to `row.id ?? row.<x>_id`)

`run.mjs` normalizes (sorts by `key`, strips volatile `updated_at`/`created_at`
unless the case opts in) and prints a unified diff. Exit code is non-zero on any
difference so it can gate CI.
