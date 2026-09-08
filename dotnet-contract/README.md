# .NET wire contract (shared models)

These files are the **shared API models** for a backend-only swap.

| File | Purpose |
|------|---------|
| `WireModels.cs` | C# DTOs with `[JsonPropertyName("snake_case")]` matching the frontend’s Supabase JSON |
| `../DOTNET_FRONTEND_CONTRACT.md` | Full docs: enums, nests, auth, inventory |

## Rule

- **Use these wire models** in .NET JSON responses/requests.
- **Do not** copy `src/data/types.ts` (camelCase UI models) onto the wire.
- Frontend maps `patient_id` → `patientId` itself after the API call.

## Quick test

Serialize a `PatientRow` and confirm the JSON keys are `patient_id`, `first_name`, … — never `PatientId` / `patientId`.
