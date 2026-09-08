# .NET Backend Implementation Plan — Clinic App

> **Audience:** This doc is written for a worker (human or AI) implementing the backend. Follow it top to bottom. Do not deviate from naming/format rules in Section 0 — they are the whole point of this migration.

## 0. Non-negotiable rules

1. **Read [DOTNET_FRONTEND_CONTRACT.md](DOTNET_FRONTEND_CONTRACT.md) first, in full.** It is the source of truth for every JSON key, enum string, and nested response shape the frontend expects. This plan tells you *what* to build; that doc tells you the *exact* wire format.
2. **JSON property names on the wire = snake_case**, matching contract §4/§5 exactly (`patient_id`, not `patientId`).
3. **Enum values on the wire = exact PascalCase strings**, matching contract §3 exactly (`"PayAtClinic"`, `"CheckedIn"`, etc.).
4. **Never rename a JSON key or enum string** to make C# conventions nicer. Rename only inside C# classes (PascalCase properties are fine — the JSON serializer handles the conversion), never in the JSON that leaves the API.
5. Reference schema: [supabase/schema.sql](supabase/schema.sql) — this is the existing Postgres schema (32 tables/views, 18 enums) being ported to SQL Server. Column names, constraints, and relationships should match it 1:1 unless this plan explicitly says otherwise.

## 1. Decisions already made (do not re-litigate)

| Decision | Choice |
|---|---|
| Auth | Full custom JWT auth in .NET — replaces Supabase Auth (`auth.users`) entirely |
| File storage | Local disk storage — replaces Supabase Storage buckets |
| Schema approach | EF Core Code-First (C# entities → `dotnet ef migrations`) |
| Target DB | SQL Server Express at `PHL8DPROG004\SQLEXPRESS`, database `ClinicAppDb` |
| Connection string | Already provided — see Section 2 `appsettings.json` |

## 2. Starting `appsettings.json`

Use this as the base config for `ClinicApp.Api`. Replace `Jwt:Secret` with a real random 32+ char value before any real use (never commit a real secret).

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=PHL8DPROG004\\SQLEXPRESS;Initial Catalog=ClinicAppDb;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=True;Application Name=\"ClinicApp\";Command Timeout=0"
  },
  "Jwt": {
    "Secret": "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS",
    "Issuer": "ClinicApp",
    "Audience": "ClinicApp",
    "AccessTokenExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 7
  },
  "Email": {
    "FromAddress": "",
    "FromName": "",
    "SmtpHost": "",
    "SmtpPort": 587,
    "SmtpUser": "",
    "SmtpPass": ""
  },
  "ClientBaseUrl": "http://localhost:3000",
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:3000"
    ]
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

Note: `ClientBaseUrl` and `Cors:AllowedOrigins` were changed from the original template's Angular defaults (`4200`/`8100`) to `3000`, because this frontend is Next.js (`next dev`, no custom port — see `package.json`).

## 3. Solution structure

```
dotnet-backend/
  ClinicApp.sln
  src/
    ClinicApp.Api/            # ASP.NET Core Web API host, controllers, Program.cs, appsettings.json
    ClinicApp.Domain/         # Entity classes + enums, no EF/infra dependencies
    ClinicApp.Infrastructure/ # EF Core DbContext, migrations, repositories, file storage service
    ClinicApp.Auth/           # JWT issuance, password hashing, auth DTOs/services
```

Keep it to these 4 projects — no more layers than that for an app this size.

## 4. Domain entities (`ClinicApp.Domain`)

Create one C# class per table listed in contract §4 (`Patient`, `StaffAccount`, `Doctor`, `DoctorSchedule`, `DoctorBlockedDate`, `DoctorDayStatus`, `Service`, `DoctorService`, `Booking`, `BookingService`, `Payment`, `Review`, `Consultation`, `ConsultationDiagnosis`, `VitalFieldTemplate`, `PatientVitalReading`, `FollowUp`, `Icd10Code`, `SoapPhrase`, `SoapTemplate`, `Medicine`, `PrescriptionGroup`, `PrescriptionLineItem`, `DoctorFavoriteMedicine`, `PrescriptionTemplate`, `PrescriptionTemplateItem`, `LabOrder`, `PatientVaccination`, `PatientDocument`, `PatientLabResult`, `AuditLog`, `Announcement`, `ClinicSetting`, `ClinicOperatingHour`, `ClinicAcceptedPaymentMethod`, `Profile`).

- Properties in PascalCase (`PatientId`, `FirstName`) — the snake_case naming convention (Section 6) maps these to columns automatically.
- Copy every column, type, nullability, default, and constraint from contract §4 / `schema.sql` — do not drop or rename columns.
- Composite keys: `BookingService` (`booking_id` + `service_id`), `DoctorService` (`doctor_id` + `service_id`), `ClinicAcceptedPaymentMethod` (`payment_method` alone as PK).

**Structural change from the Postgres schema:** `profiles.id`, `patients.user_id`, and `staff_accounts.user_id` no longer reference `auth.users` (Supabase-managed). Instead:

- Create a new `User` entity in `ClinicApp.Auth` (not `ClinicApp.Domain`): `Id` (Guid), `Email`, `PasswordHash`, `EmailConfirmed`, `CreatedAt`.
- `Profile.Id`, `Patient.UserId`, `StaffAccount.UserId` are FKs to this new `Users` table instead.
- Everywhere contract mentions `auth.users.id` or `user.id`, it now means this new `Users.Id`.

### Enums

Create 18 C# enums matching contract §3 exactly (`UserRole`, `StaffRole`, `StaffStatus`, `SexType`, `DoctorDayStatusEnum`, `ServiceCategory`, `BookingStatus`, `PaymentMode`, `PaymentStatus`, `PaymentMethod`, `ProofType`, `ConsultationStatus`, `DiagnosisType`, `SoapField`, `LabOrderStatus`, `VaccinationStatus`, `VaccinationSource`, `AuditEntityType`, `FollowUpStatus`). Member names must match the exact strings, e.g.:

```csharp
public enum BookingStatus
{
    Pending, ProofSubmitted, Confirmed, CheckedIn, InProgress,
    OnHold, Cancelled, Completed, Expired, NoShow, Rescheduled
}
```

Apply `[JsonConverter(typeof(JsonStringEnumConverter))]` so they serialize as these exact strings, not integers.

## 5. EF Core setup (`ClinicApp.Infrastructure`)

1. Add NuGet packages: `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.EntityFrameworkCore.Tools`, `EFCore.NamingConventions`.
2. `ClinicAppDbContext : DbContext` with a `DbSet<T>` per entity from Section 4, plus `DbSet<User>` and `DbSet<RefreshToken>` from `ClinicApp.Auth`.
3. In `AddDbContext` / `OnConfiguring`, call `.UseSqlServer(connectionString).UseSnakeCaseNamingConvention()` — this auto-maps `PatientId` → `patient_id`, `FirstName` → `first_name`, etc. **After the first migration, verify a few tricky columns match the contract exactly** (e.g. `philhealth_number`, `hmo_card_number`, `ptr_number`, `s2_number`) — these must not become `phil_health_number` etc.
4. Enum columns: `modelBuilder.Entity<Booking>().Property(b => b.Status).HasConversion<string>()` (repeat per enum column) so SQL Server stores the exact string, not an int. Add a `CHECK` constraint per enum column restricting to the exact value list from contract §3 (via `.HasCheckConstraint(...)` or raw SQL in the migration).
5. Composite keys: `modelBuilder.Entity<BookingService>().HasKey(bs => new { bs.BookingId, bs.ServiceId });` (same pattern for `DoctorService`).
6. Reporting views — create as keyless entities:
   ```csharp
   modelBuilder.Entity<VDoctorRating>().ToView("v_doctor_ratings").HasNoKey();
   ```
   Add T-SQL `CREATE VIEW` statements for the 4 views in a migration's raw SQL (`migrationBuilder.Sql(...)`), translating from `schema.sql` §I:
   - `v_doctor_ratings`
   - `v_daily_booking_summary`
   - `v_unpaid_completed_visits`
   - `v_pending_follow_ups`
   Translation notes: Postgres `||` (string concat) → SQL Server `+`; Postgres `count(*) filter (where ...)` → SQL Server `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`; `coalesce` works the same in both.
7. `UpdatedAt` auto-stamping: override `SaveChangesAsync` in `ClinicAppDbContext` to set `UpdatedAt = DateTimeOffset.UtcNow` on every modified entity that has that property (use reflection or a shared `IHasUpdatedAt` interface) — this replaces Postgres's `set_updated_at()` trigger.
8. Seed data via `HasData(...)` in `OnModelCreating`, copied verbatim from `schema.sql`'s seed section at the bottom:
   - `clinic_settings`: 1 row (`id=1, clinic_name='Dr. Grace Gavino Medical Clinic', address='TBD'`)
   - `clinic_operating_hours`: 7 rows (Sunday closed, Mon–Fri 08:00–17:00, Sat 08:00–12:00)
   - `clinic_accepted_payment_methods`: `Cash`, `GCash`, `Maya`, `BankTransfer`
   - `icd10_codes`: 5 starter codes (`Z00.0`, `I10`, `J06.9`, `E11.9`, `J45.909`)
   - `vital_field_templates`: 9 rows (7 defaults + 2 custom examples — see `schema.sql` lines 928–938 for exact values)
   - `medicines`: 15 starter generic names — see `schema.sql` lines 942–958 for exact list
9. Run:
   ```bash
   dotnet ef migrations add InitialCreate --project ClinicApp.Infrastructure --startup-project ClinicApp.Api
   dotnet ef database update --project ClinicApp.Infrastructure --startup-project ClinicApp.Api
   ```
   This creates `ClinicAppDb` on `PHL8DPROG004\SQLEXPRESS` using the connection string in Section 2.

## 6. Auth (`ClinicApp.Auth`)

### Entities
- `User`: `Id` (Guid PK), `Email`, `PasswordHash`, `EmailConfirmed` (bool), `CreatedAt`.
- `RefreshToken`: `Id`, `UserId` (FK), `TokenHash`, `ExpiresAt`, `RevokedAt` (nullable).

### Endpoints (`AuthController`, under `/api/auth`)

| Endpoint | Replaces | Notes |
|---|---|---|
| `POST /api/auth/login` | `signInWithPassword` | Body: `{ email, password }`. Returns `{ access_token, refresh_token, user_id, role }`. |
| `POST /api/auth/register` | `signUp` | Body: `{ email, password }`. Creates `User` row, returns `user_id`. Frontend then calls its own `registerPatientAccount` server action (unchanged, camelCase — separate layer per contract §9). |
| `POST /api/auth/refresh` | — | Body: `{ refresh_token }`. Issues new access token if refresh token valid & not revoked/expired. |
| `POST /api/auth/logout` | `signOut` | Revokes the refresh token. |
| `POST /api/auth/reset-password-request` | `resetPasswordForEmail` | Body: `{ email }`. Sends reset link using `ClientBaseUrl` + a new completion route (fills gap noted in contract §15 — there is currently no reset-password completion page in the frontend; flag this to whoever owns frontend work). |
| `POST /api/auth/reset-password` | `updateUser({password})` | Body: `{ token, new_password }`. |
| `POST /api/auth/resend-confirmation` | `auth.resend` | Body: `{ email }`. |
| `POST /api/auth/invite` | `auth.admin.inviteUserByEmail` | Admin/Staff only. Body: `{ email }`. Returns `user_id`. Used by `inviteStaffMember`/`createDoctor` server actions. |
| `DELETE /api/auth/users/{id}` | `auth.admin.deleteUser` | Admin only. |

- Password hashing: use `Microsoft.AspNetCore.Identity.PasswordHasher<User>` (built into ASP.NET Core, no extra package needed) or BCrypt.Net-Next.
- JWT: `sub` claim = `User.Id`, `role` claim = the user's `Profile.Role`. Sign with `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience` from config.
- Protect controllers with `[Authorize(Roles = "Patient,Staff,Doctor,Admin")]` matching the role-per-route rules in contract §11 (`/patient/**` → Patient, `/staff/**` → Staff, etc.).

## 7. File storage (`ClinicApp.Infrastructure`)

```csharp
public interface IFileStorageService
{
    Task<string> SaveAsync(Guid patientId, Guid bookingId, string fileName, Stream content, string contentType);
    Task DeleteAsync(string relativePath);
}
```

- Local disk implementation: save under `App_Data/uploads/{patientId}/{bookingId}/{timestamp}-{sanitizedFileName}` (matches the existing pattern in contract §8).
- Serve via `app.UseStaticFiles(...)` pointed at that root, or a dedicated `GET /api/files/{**path}` controller action.
- Validate: max 10 MB, allowed MIME types = `pdf, jpeg, png, webp, gif, msword, docx` (same list as `src/lib/patientUploads.ts`).
- The URL returned goes straight into `file_url` on `patient_documents` / `patient_lab_results` rows — same shape as today, just pointing at the local API instead of Supabase Storage.

## 8. API controllers (`ClinicApp.Api`)

Build these controllers. Every response DTO must produce JSON matching contract §4–§6 exactly (snake_case keys, nested embed shapes where noted).

| Controller | Routes cover | Contract section |
|---|---|---|
| `AuthController` | See Section 6 | §7 |
| `ProfilesController` | `profiles` | §4 |
| `PatientsController` | `patients` CRUD, consent update | §4, §10 |
| `StaffAccountsController` | `staff_accounts` CRUD, invite/revoke | §4, §9, §10 |
| `DoctorsController` | `doctors`, `doctor_schedules`, `doctor_blocked_dates`, `doctor_day_statuses`, `doctor_services` | §4, §6, §10 |
| `ServicesController` | `services` catalog | §4 |
| `BookingsController` | `bookings`, `booking_services`, queue number (count-based), walk-in creation | §4, §10 |
| `PaymentsController` | `payments` confirm/waive/refund | §4, §10 |
| `ReviewsController` | `reviews` | §4, §10 |
| `ConsultationsController` | `consultations` upsert-by-booking, `consultation_diagnoses` replace-all, `audit_logs` write | §4, §10 |
| `VitalsController` | `vital_field_templates`, `patient_vital_readings` upsert-by-(booking,template) | §4, §10 |
| `FollowUpsController` | `follow_ups` upsert/delete | §4, §5, §10 |
| `PrescriptionsController` | `prescription_groups`, `prescription_line_items`, `prescription_templates`(+items), `doctor_favorite_medicines`, `medicines` | §4, §10 |
| `SoapController` | `soap_phrases`, `soap_templates` | §4, §10 |
| `LabOrdersController` | `lab_orders` (schema exists, UI doesn't call it yet per §15 — build anyway) | §4, §15 |
| `PatientFilesController` | `patient_documents`, `patient_lab_results`, upload endpoint (Section 7) | §4, §8, §10 |
| `VaccinationsController` | `patient_vaccinations` (read-focused; write endpoint for future UI use) | §4, §10, §15 |
| `AdminController` | `clinic_settings`, `clinic_operating_hours`, `clinic_accepted_payment_methods`, `announcements`, `audit_logs` (read), the 4 report views | §4, §5, §10 |

### Nested embed DTOs (contract §6)

Build these exact shapes wherever the frontend currently reads a Supabase nested select:

```
doctors(staff_accounts(full_name))
doctors(staff_accounts(full_name, status))
doctors(staff_accounts(full_name, email))
doctors(staff_accounts(full_name, email, status))
doctors(specialization, staff_accounts(full_name))
patients(first_name, last_name)
patients(first_name, last_name, patient_code)
patients(first_name, last_name, patient_code, contact_number, email)
patients(first_name, last_name, contact_number, email, sex, date_of_birth)
booking_services(services(name))
booking_services(services(name, price))
payments(status)
prescription_line_items(*)
prescription_template_items(*)
consultation_diagnoses(custom_description)
consultation_diagnoses(custom_description, type)
follow_ups(follow_up_date, instructions)
bookings(appointment_date)
bookings(appointment_date, doctors(staff_accounts(full_name)))
bookings(doctors(staff_accounts(full_name)))
services(name, category, price)
```

Example: a `GET /api/doctors` response must look like:
```json
{
  "doctor_id": "…",
  "specialization": "…",
  "staff_accounts": { "full_name": "Dr. Grace", "email": "…", "status": "Active" }
}
```

## 9. JSON + CORS config (`ClinicApp.Api/Program.cs`)

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower; // .NET 8+
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>())
              .AllowAnyHeader()
              .AllowAnyMethod());
});
```

If the target framework doesn't ship `JsonNamingPolicy.SnakeCaseLower` (added in .NET 8), write a small custom `SnakeCaseNamingPolicy : JsonNamingPolicy` instead.

## 10. Verification checklist

- [ ] `dotnet build` succeeds across all 4 projects.
- [ ] `dotnet ef database update` creates `ClinicAppDb` on `PHL8DPROG004\SQLEXPRESS` without errors.
- [ ] `sqlcmd -S "PHL8DPROG004\SQLEXPRESS" -E -Q "SELECT TOP 5 * FROM ClinicAppDb.dbo.patients" -C` shows snake_case columns.
- [ ] Enum columns hold exact contract strings (spot-check `bookings.status`, `payments.status`).
- [ ] `dotnet run` starts the API without errors.
- [ ] `POST /api/auth/register` + `POST /api/auth/login` returns a JWT with correct `role` claim.
- [ ] `GET /api/doctors` response has `doctor_id` (not `doctorId`) and nested `staff_accounts.full_name` matching the example in Section 8.
- [ ] File upload via `PatientFilesController` writes a file to `App_Data/uploads/...` and the returned `file_url` is reachable.
- [ ] Compare a handful of real responses against contract §4/§6 key-by-key — no renamed or dropped keys.

## 11. Out of scope for this pass

Rewiring the Next.js frontend (`src/lib/supabase/*`, `SessionProvider.tsx`, every `.from(...)` call under `src/`) to call this new API instead of Supabase is a **separate, later phase**. Do not touch frontend code as part of this backend build — the frontend keeps working against Supabase until that phase starts.
