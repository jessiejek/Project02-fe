// Shared wire models for UHS-WEB-edit frontend compatibility.
// JSON property names MUST stay snake_case — they match Supabase PostgREST / src/data/supabase-types.ts.
// Do NOT rename to match src/data/types.ts (camelCase UI models).
//
// Usage: copy into your .NET API project. Configure JSON to honor [JsonPropertyName]:
//   options.PropertyNamingPolicy = null;

using System.Text.Json.Serialization;

namespace Clinic.Wire;

#region Enum string constants (exact values the FE sends/receives)

public static class WireEnums
{
    public static class UserRole
    {
        public const string Patient = "Patient";
        public const string Staff = "Staff";
        public const string Doctor = "Doctor";
        public const string Admin = "Admin";
    }

    public static class StaffStatus
    {
        public const string Active = "Active";
        public const string Inactive = "Inactive";
        public const string Invited = "Invited";
        public const string OnLeave = "OnLeave";
    }

    public static class BookingStatus
    {
        public const string Pending = "Pending";
        public const string ProofSubmitted = "ProofSubmitted";
        public const string Confirmed = "Confirmed";
        public const string CheckedIn = "CheckedIn";
        public const string InProgress = "InProgress";
        public const string OnHold = "OnHold";
        public const string Cancelled = "Cancelled";
        public const string Completed = "Completed";
        public const string Expired = "Expired";
        public const string NoShow = "NoShow";
        public const string Rescheduled = "Rescheduled";
    }

    public static class PaymentMode
    {
        public const string Online = "Online";
        public const string PayAtClinic = "PayAtClinic";
    }

    public static class PaymentStatus
    {
        public const string Unpaid = "Unpaid";
        public const string Paid = "Paid";
        public const string Waived = "Waived";
        public const string Refunded = "Refunded";
    }

    public static class PaymentMethod
    {
        public const string Cash = "Cash";
        public const string GCash = "GCash";
        public const string Maya = "Maya";
        public const string BankTransfer = "BankTransfer";
    }
}

#endregion

#region Core tables

public sealed class ProfileRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("role")] public string Role { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class PatientRow
{
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("user_id")] public string? UserId { get; set; }
    [JsonPropertyName("patient_code")] public string PatientCode { get; set; } = "";
    [JsonPropertyName("first_name")] public string FirstName { get; set; } = "";
    [JsonPropertyName("middle_name")] public string? MiddleName { get; set; }
    [JsonPropertyName("last_name")] public string LastName { get; set; } = "";
    [JsonPropertyName("date_of_birth")] public string DateOfBirth { get; set; } = "";
    [JsonPropertyName("sex")] public string Sex { get; set; } = "";
    [JsonPropertyName("civil_status")] public string? CivilStatus { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("city")] public string? City { get; set; }
    [JsonPropertyName("zip_code")] public string? ZipCode { get; set; }
    [JsonPropertyName("contact_number")] public string? ContactNumber { get; set; }
    [JsonPropertyName("email")] public string Email { get; set; } = "";
    [JsonPropertyName("emergency_contact_name")] public string? EmergencyContactName { get; set; }
    [JsonPropertyName("emergency_contact_number")] public string? EmergencyContactNumber { get; set; }
    [JsonPropertyName("emergency_contact_relationship")] public string? EmergencyContactRelationship { get; set; }
    [JsonPropertyName("blood_type")] public string? BloodType { get; set; }
    [JsonPropertyName("philhealth_number")] public string? PhilhealthNumber { get; set; }
    [JsonPropertyName("hmo_provider")] public string? HmoProvider { get; set; }
    [JsonPropertyName("hmo_card_number")] public string? HmoCardNumber { get; set; }
    [JsonPropertyName("is_guest")] public bool IsGuest { get; set; }
    [JsonPropertyName("is_email_verified")] public bool IsEmailVerified { get; set; }
    [JsonPropertyName("consented_at")] public string? ConsentedAt { get; set; }
    [JsonPropertyName("consent_version")] public int ConsentVersion { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class StaffAccountRow
{
    [JsonPropertyName("staff_id")] public string StaffId { get; set; } = "";
    [JsonPropertyName("user_id")] public string UserId { get; set; } = "";
    [JsonPropertyName("full_name")] public string FullName { get; set; } = "";
    [JsonPropertyName("email")] public string Email { get; set; } = "";
    [JsonPropertyName("contact_number")] public string? ContactNumber { get; set; }
    [JsonPropertyName("role")] public string Role { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("avatar_url")] public string? AvatarUrl { get; set; }
    [JsonPropertyName("invited_at")] public string InvitedAt { get; set; } = "";
    [JsonPropertyName("revoked_at")] public string? RevokedAt { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class DoctorRow
{
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("specialization")] public string Specialization { get; set; } = "";
    [JsonPropertyName("consultation_fee")] public decimal ConsultationFee { get; set; }
    [JsonPropertyName("bio")] public string? Bio { get; set; }
    [JsonPropertyName("license_number")] public string? LicenseNumber { get; set; }
    [JsonPropertyName("ptr_number")] public string? PtrNumber { get; set; }
    [JsonPropertyName("s2_number")] public string? S2Number { get; set; }
    [JsonPropertyName("slot_duration_minutes")] public int SlotDurationMinutes { get; set; }
    [JsonPropertyName("slot_capacity")] public int SlotCapacity { get; set; }
    [JsonPropertyName("daily_patient_limit")] public int? DailyPatientLimit { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";

    /// <summary>Nested embed: doctors(..., staff_accounts(...))</summary>
    [JsonPropertyName("staff_accounts")] public StaffAccountEmbed? StaffAccounts { get; set; }
}

public sealed class StaffAccountEmbed
{
    [JsonPropertyName("full_name")] public string? FullName { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("avatar_url")] public string? AvatarUrl { get; set; }
}

public sealed class DoctorScheduleRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("day_of_week")] public int DayOfWeek { get; set; }
    [JsonPropertyName("is_active")] public bool IsActive { get; set; }
    [JsonPropertyName("start_time")] public string StartTime { get; set; } = "";
    [JsonPropertyName("end_time")] public string EndTime { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class DoctorBlockedDateRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("blocked_date")] public string BlockedDate { get; set; } = "";
    [JsonPropertyName("reason")] public string? Reason { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class DoctorDayStatusRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("status_date")] public string StatusDate { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("running_late_minutes")] public int? RunningLateMinutes { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class ServiceRow
{
    [JsonPropertyName("service_id")] public string ServiceId { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("category")] public string Category { get; set; } = "";
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("price")] public decimal Price { get; set; }
    [JsonPropertyName("is_active")] public bool IsActive { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class DoctorServiceRow
{
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("service_id")] public string ServiceId { get; set; } = "";
    [JsonPropertyName("duration_minutes")] public int DurationMinutes { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("services")] public ServiceEmbed? Services { get; set; }
}

public sealed class ServiceEmbed
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("category")] public string? Category { get; set; }
    [JsonPropertyName("price")] public decimal? Price { get; set; }
}

public sealed class BookingRow
{
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("appointment_date")] public string AppointmentDate { get; set; } = "";
    [JsonPropertyName("slot_start_time")] public string SlotStartTime { get; set; } = "";
    [JsonPropertyName("slot_end_time")] public string SlotEndTime { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("payment_mode")] public string PaymentMode { get; set; } = "";
    [JsonPropertyName("queue_number")] public string? QueueNumber { get; set; }
    [JsonPropertyName("consultation_fee_snapshot")] public decimal ConsultationFeeSnapshot { get; set; }
    [JsonPropertyName("total_fee")] public decimal TotalFee { get; set; }
    [JsonPropertyName("amount_due")] public decimal AmountDue { get; set; }
    [JsonPropertyName("is_walk_in")] public bool IsWalkIn { get; set; }
    [JsonPropertyName("proof_type")] public string? ProofType { get; set; }
    [JsonPropertyName("proof_value")] public string? ProofValue { get; set; }
    [JsonPropertyName("proof_submitted_at")] public string? ProofSubmittedAt { get; set; }
    [JsonPropertyName("cancelled_by_user_id")] public string? CancelledByUserId { get; set; }
    [JsonPropertyName("cancellation_reason")] public string? CancellationReason { get; set; }
    [JsonPropertyName("notes")] public string? Notes { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";

    [JsonPropertyName("patients")] public PatientEmbed? Patients { get; set; }
    [JsonPropertyName("doctors")] public DoctorEmbed? Doctors { get; set; }
    [JsonPropertyName("booking_services")] public List<BookingServiceEmbed>? BookingServices { get; set; }
    [JsonPropertyName("payments")] public PaymentEmbed? Payments { get; set; }
}

public sealed class PatientEmbed
{
    [JsonPropertyName("first_name")] public string? FirstName { get; set; }
    [JsonPropertyName("last_name")] public string? LastName { get; set; }
    [JsonPropertyName("patient_code")] public string? PatientCode { get; set; }
    [JsonPropertyName("contact_number")] public string? ContactNumber { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("sex")] public string? Sex { get; set; }
    [JsonPropertyName("date_of_birth")] public string? DateOfBirth { get; set; }
    [JsonPropertyName("user_id")] public string? UserId { get; set; }
    [JsonPropertyName("is_guest")] public bool? IsGuest { get; set; }
}

public sealed class DoctorEmbed
{
    [JsonPropertyName("specialization")] public string? Specialization { get; set; }
    [JsonPropertyName("consultation_fee")] public decimal? ConsultationFee { get; set; }
    [JsonPropertyName("slot_duration_minutes")] public int? SlotDurationMinutes { get; set; }
    [JsonPropertyName("staff_accounts")] public StaffAccountEmbed? StaffAccounts { get; set; }
}

public sealed class BookingServiceEmbed
{
    [JsonPropertyName("booking_id")] public string? BookingId { get; set; }
    [JsonPropertyName("service_id")] public string? ServiceId { get; set; }
    [JsonPropertyName("price_at_booking")] public decimal? PriceAtBooking { get; set; }
    [JsonPropertyName("services")] public ServiceEmbed? Services { get; set; }
}

public sealed class PaymentEmbed
{
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("waived_reason")] public string? WaivedReason { get; set; }
}

public sealed class BookingServiceRow
{
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("service_id")] public string ServiceId { get; set; } = "";
    [JsonPropertyName("price_at_booking")] public decimal PriceAtBooking { get; set; }
}

public sealed class PaymentRow
{
    [JsonPropertyName("payment_id")] public string PaymentId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("amount")] public decimal Amount { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("payment_method")] public string? PaymentMethod { get; set; }
    [JsonPropertyName("reference_number")] public string? ReferenceNumber { get; set; }
    [JsonPropertyName("or_number")] public string? OrNumber { get; set; }
    [JsonPropertyName("amount_received")] public decimal? AmountReceived { get; set; }
    [JsonPropertyName("confirm_notes")] public string? ConfirmNotes { get; set; }
    [JsonPropertyName("confirmed_by_user_id")] public string? ConfirmedByUserId { get; set; }
    [JsonPropertyName("confirmed_at")] public string? ConfirmedAt { get; set; }
    [JsonPropertyName("waived_by_user_id")] public string? WaivedByUserId { get; set; }
    [JsonPropertyName("waived_reason")] public string? WaivedReason { get; set; }
    [JsonPropertyName("waived_at")] public string? WaivedAt { get; set; }
    [JsonPropertyName("refunded_by_user_id")] public string? RefundedByUserId { get; set; }
    [JsonPropertyName("refund_amount")] public decimal? RefundAmount { get; set; }
    [JsonPropertyName("refund_reason")] public string? RefundReason { get; set; }
    [JsonPropertyName("refunded_at")] public string? RefundedAt { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class ReviewRow
{
    [JsonPropertyName("review_id")] public string ReviewId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("rating")] public int Rating { get; set; }
    [JsonPropertyName("comment")] public string? Comment { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

#endregion

#region Clinical

public sealed class ConsultationRow
{
    [JsonPropertyName("consultation_id")] public string ConsultationId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("chief_complaint")] public string? ChiefComplaint { get; set; }
    [JsonPropertyName("subjective")] public string? Subjective { get; set; }
    [JsonPropertyName("objective")] public string? Objective { get; set; }
    [JsonPropertyName("assessment")] public string? Assessment { get; set; }
    [JsonPropertyName("plan")] public string? Plan { get; set; }
    [JsonPropertyName("doctor_notes")] public string? DoctorNotes { get; set; }
    [JsonPropertyName("completed_by_user_id")] public string? CompletedByUserId { get; set; }
    [JsonPropertyName("completed_at")] public string? CompletedAt { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";

    [JsonPropertyName("bookings")] public BookingDateEmbed? Bookings { get; set; }
    [JsonPropertyName("doctors")] public DoctorEmbed? Doctors { get; set; }
    [JsonPropertyName("consultation_diagnoses")] public List<ConsultationDiagnosisEmbed>? ConsultationDiagnoses { get; set; }
    [JsonPropertyName("follow_ups")] public FollowUpEmbed? FollowUps { get; set; }
}

public sealed class BookingDateEmbed
{
    [JsonPropertyName("appointment_date")] public string? AppointmentDate { get; set; }
    [JsonPropertyName("doctor_id")] public string? DoctorId { get; set; }
}

public sealed class ConsultationDiagnosisRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string ConsultationId { get; set; } = "";
    [JsonPropertyName("icd10_code")] public string? Icd10Code { get; set; }
    [JsonPropertyName("custom_description")] public string? CustomDescription { get; set; }
    [JsonPropertyName("type")] public string Type { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class ConsultationDiagnosisEmbed
{
    [JsonPropertyName("custom_description")] public string? CustomDescription { get; set; }
    [JsonPropertyName("type")] public string? Type { get; set; }
}

public sealed class FollowUpRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string ConsultationId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("follow_up_date")] public string FollowUpDate { get; set; } = "";
    [JsonPropertyName("reason")] public string? Reason { get; set; }
    [JsonPropertyName("instructions")] public string? Instructions { get; set; }
    [JsonPropertyName("reminder_enabled")] public bool ReminderEnabled { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class FollowUpEmbed
{
    [JsonPropertyName("follow_up_date")] public string? FollowUpDate { get; set; }
    [JsonPropertyName("instructions")] public string? Instructions { get; set; }
}

public sealed class VitalFieldTemplateRow
{
    [JsonPropertyName("template_id")] public string TemplateId { get; set; } = "";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("form_key")] public string FormKey { get; set; } = "";
    [JsonPropertyName("unit")] public string Unit { get; set; } = "";
    [JsonPropertyName("icon")] public string Icon { get; set; } = "";
    [JsonPropertyName("is_default")] public bool IsDefault { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class PatientVitalReadingRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("template_id")] public string TemplateId { get; set; } = "";
    [JsonPropertyName("value")] public string Value { get; set; } = "";
    [JsonPropertyName("recorded_at")] public string RecordedAt { get; set; } = "";
    // PROPOSED — not in the live DB yet. See DOTNET_FRONTEND_CONTRACT.md §16.1
    // (staff-recorded vitals at walk-in intake). Nullable/optional until a
    // migration adds the column; safe to serialize now (omitted when null).
    [JsonPropertyName("recorded_by_user_id")] public string? RecordedByUserId { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class MedicineRow
{
    [JsonPropertyName("medicine_id")] public string MedicineId { get; set; } = "";
    [JsonPropertyName("generic_name")] public string GenericName { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class PrescriptionGroupRow
{
    [JsonPropertyName("group_id")] public string GroupId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
    [JsonPropertyName("prescription_line_items")] public List<PrescriptionLineItemRow>? PrescriptionLineItems { get; set; }
    [JsonPropertyName("bookings")] public BookingWithDoctorEmbed? Bookings { get; set; }
}

public sealed class BookingWithDoctorEmbed
{
    [JsonPropertyName("appointment_date")] public string? AppointmentDate { get; set; }
    [JsonPropertyName("doctors")] public DoctorEmbed? Doctors { get; set; }
}

public sealed class PrescriptionLineItemRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("group_id")] public string GroupId { get; set; } = "";
    [JsonPropertyName("medicine_id")] public string MedicineId { get; set; } = "";
    [JsonPropertyName("generic_name")] public string GenericName { get; set; } = "";
    [JsonPropertyName("dosage")] public string Dosage { get; set; } = "";
    [JsonPropertyName("quantity")] public string Quantity { get; set; } = "";
    [JsonPropertyName("instruction")] public string? Instruction { get; set; }
    [JsonPropertyName("is_controlled_substance")] public bool IsControlledSubstance { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class PrescriptionTemplateRow
{
    [JsonPropertyName("template_id")] public string TemplateId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("is_system_template")] public bool IsSystemTemplate { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
    [JsonPropertyName("prescription_template_items")] public List<PrescriptionTemplateItemRow>? PrescriptionTemplateItems { get; set; }
}

public sealed class PrescriptionTemplateItemRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("template_id")] public string TemplateId { get; set; } = "";
    [JsonPropertyName("medicine_id")] public string MedicineId { get; set; } = "";
    [JsonPropertyName("generic_name")] public string GenericName { get; set; } = "";
    [JsonPropertyName("dosage")] public string Dosage { get; set; } = "";
    [JsonPropertyName("quantity")] public string Quantity { get; set; } = "";
    [JsonPropertyName("instruction")] public string? Instruction { get; set; }
    [JsonPropertyName("is_controlled_substance")] public bool IsControlledSubstance { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class DoctorFavoriteMedicineRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("medicine_id")] public string MedicineId { get; set; } = "";
    [JsonPropertyName("generic_name")] public string GenericName { get; set; } = "";
    [JsonPropertyName("dosage")] public string Dosage { get; set; } = "";
    [JsonPropertyName("quantity")] public string Quantity { get; set; } = "";
    [JsonPropertyName("instruction")] public string? Instruction { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
}

public sealed class SoapTemplateRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("is_system_template")] public bool IsSystemTemplate { get; set; }
    [JsonPropertyName("chief_complaint")] public string? ChiefComplaint { get; set; }
    [JsonPropertyName("subjective")] public string? Subjective { get; set; }
    [JsonPropertyName("objective")] public string? Objective { get; set; }
    [JsonPropertyName("assessment")] public string? Assessment { get; set; }
    [JsonPropertyName("plan")] public string? Plan { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class SoapPhraseRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("field")] public string Field { get; set; } = "";
    [JsonPropertyName("label")] public string Label { get; set; } = "";
    [JsonPropertyName("body")] public string Body { get; set; } = "";
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class LabOrderRow
{
    [JsonPropertyName("lab_order_id")] public string LabOrderId { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string ConsultationId { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("doctor_id")] public string DoctorId { get; set; } = "";
    [JsonPropertyName("test_name")] public string TestName { get; set; } = "";
    [JsonPropertyName("test_code")] public string? TestCode { get; set; }
    [JsonPropertyName("reason")] public string? Reason { get; set; }
    [JsonPropertyName("clinical_indication")] public string? ClinicalIndication { get; set; }
    [JsonPropertyName("specimen_type")] public string? SpecimenType { get; set; }
    [JsonPropertyName("notes")] public string? Notes { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("requested_at")] public string RequestedAt { get; set; } = "";
    [JsonPropertyName("result_attachment_url")] public string? ResultAttachmentUrl { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class PatientVaccinationRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string? ConsultationId { get; set; }
    [JsonPropertyName("vaccine_name")] public string VaccineName { get; set; } = "";
    [JsonPropertyName("manufacturer")] public string? Manufacturer { get; set; }
    [JsonPropertyName("dose_number")] public int? DoseNumber { get; set; }
    [JsonPropertyName("route")] public string? Route { get; set; }
    [JsonPropertyName("site")] public string? Site { get; set; }
    [JsonPropertyName("lot_number")] public string? LotNumber { get; set; }
    [JsonPropertyName("expiry_date")] public string? ExpiryDate { get; set; }
    [JsonPropertyName("administered_date")] public string? AdministeredDate { get; set; }
    [JsonPropertyName("administered_by")] public string? AdministeredBy { get; set; }
    [JsonPropertyName("next_dose_date")] public string? NextDoseDate { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("source")] public string Source { get; set; } = "";
    [JsonPropertyName("notes")] public string? Notes { get; set; }
    [JsonPropertyName("reaction_notes")] public string? ReactionNotes { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

#endregion

#region Files, settings, views

public sealed class PatientDocumentRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string? ConsultationId { get; set; }
    [JsonPropertyName("file_name")] public string FileName { get; set; } = "";
    [JsonPropertyName("file_size")] public long? FileSize { get; set; }
    [JsonPropertyName("file_content_type")] public string? FileContentType { get; set; }
    [JsonPropertyName("title")] public string? Title { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("file_url")] public string FileUrl { get; set; } = "";
    [JsonPropertyName("uploaded_by_user_id")] public string? UploadedByUserId { get; set; }
    [JsonPropertyName("uploaded_at")] public string UploadedAt { get; set; } = "";
    [JsonPropertyName("bookings")] public BookingWithDoctorEmbed? Bookings { get; set; }
}

public sealed class PatientLabResultRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("patient_id")] public string PatientId { get; set; } = "";
    [JsonPropertyName("booking_id")] public string BookingId { get; set; } = "";
    [JsonPropertyName("consultation_id")] public string? ConsultationId { get; set; }
    [JsonPropertyName("lab_order_id")] public string? LabOrderId { get; set; }
    [JsonPropertyName("file_name")] public string FileName { get; set; } = "";
    [JsonPropertyName("file_content_type")] public string? FileContentType { get; set; }
    [JsonPropertyName("result_title")] public string? ResultTitle { get; set; }
    [JsonPropertyName("result_text")] public string? ResultText { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("file_url")] public string FileUrl { get; set; } = "";
    [JsonPropertyName("uploaded_at")] public string UploadedAt { get; set; } = "";
}

public sealed class AuditLogRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("entity_type")] public string EntityType { get; set; } = "";
    [JsonPropertyName("entity_id")] public string EntityId { get; set; } = "";
    [JsonPropertyName("action")] public string Action { get; set; } = "";
    [JsonPropertyName("performed_by_user_id")] public string? PerformedByUserId { get; set; }
    [JsonPropertyName("details")] public string? Details { get; set; }
    [JsonPropertyName("performed_at")] public string PerformedAt { get; set; } = "";
}

public sealed class AnnouncementRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("body")] public string Body { get; set; } = "";
    [JsonPropertyName("is_active")] public bool IsActive { get; set; }
    [JsonPropertyName("posted_by_user_id")] public string? PostedByUserId { get; set; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class ClinicSettingsRow
{
    [JsonPropertyName("id")] public int Id { get; set; } = 1;
    [JsonPropertyName("clinic_name")] public string ClinicName { get; set; } = "";
    [JsonPropertyName("address")] public string Address { get; set; } = "";
    [JsonPropertyName("contact_number")] public string? ContactNumber { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("default_payment_mode")] public string DefaultPaymentMode { get; set; } = "";
    [JsonPropertyName("refund_policy")] public string? RefundPolicy { get; set; }
    [JsonPropertyName("consent_version")] public int ConsentVersion { get; set; }
    [JsonPropertyName("primary_color")] public string? PrimaryColor { get; set; }
    [JsonPropertyName("secondary_color")] public string? SecondaryColor { get; set; }
    [JsonPropertyName("logo_url")] public string? LogoUrl { get; set; }
    [JsonPropertyName("favicon_url")] public string? FaviconUrl { get; set; }
    [JsonPropertyName("website_url")] public string? WebsiteUrl { get; set; }
    [JsonPropertyName("privacy_policy_text")] public string? PrivacyPolicyText { get; set; }
    [JsonPropertyName("updated_by_user_id")] public string? UpdatedByUserId { get; set; }
    [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
}

public sealed class ClinicOperatingHoursRow
{
    [JsonPropertyName("day_of_week")] public int DayOfWeek { get; set; }
    [JsonPropertyName("is_closed")] public bool IsClosed { get; set; }
    [JsonPropertyName("open_time")] public string? OpenTime { get; set; }
    [JsonPropertyName("close_time")] public string? CloseTime { get; set; }
}

public sealed class ClinicAcceptedPaymentMethodRow
{
    [JsonPropertyName("payment_method")] public string PaymentMethod { get; set; } = "";
}

public sealed class VDoctorRatingsRow
{
    [JsonPropertyName("doctor_id")] public string? DoctorId { get; set; }
    [JsonPropertyName("average_rating")] public decimal? AverageRating { get; set; }
    [JsonPropertyName("review_count")] public long? ReviewCount { get; set; }
}

public sealed class VDailyBookingSummaryRow
{
    [JsonPropertyName("appointment_date")] public string? AppointmentDate { get; set; }
    [JsonPropertyName("total_bookings")] public long? TotalBookings { get; set; }
    [JsonPropertyName("completed_count")] public long? CompletedCount { get; set; }
    [JsonPropertyName("paid_count")] public long? PaidCount { get; set; }
    [JsonPropertyName("unpaid_count")] public long? UnpaidCount { get; set; }
    [JsonPropertyName("no_show_count")] public long? NoShowCount { get; set; }
    [JsonPropertyName("revenue")] public decimal? Revenue { get; set; }
}

public sealed class VUnpaidCompletedVisitRow
{
    [JsonPropertyName("booking_id")] public string? BookingId { get; set; }
    [JsonPropertyName("patient_id")] public string? PatientId { get; set; }
    [JsonPropertyName("patient_code")] public string? PatientCode { get; set; }
    [JsonPropertyName("patient_name")] public string? PatientName { get; set; }
    [JsonPropertyName("doctor_id")] public string? DoctorId { get; set; }
    [JsonPropertyName("doctor_name")] public string? DoctorName { get; set; }
    [JsonPropertyName("appointment_date")] public string? AppointmentDate { get; set; }
    [JsonPropertyName("amount_due")] public decimal? AmountDue { get; set; }
    [JsonPropertyName("payment_status")] public string? PaymentStatus { get; set; }
}

public sealed class VPendingFollowUpRow
{
    [JsonPropertyName("follow_up_id")] public string? FollowUpId { get; set; }
    [JsonPropertyName("patient_id")] public string? PatientId { get; set; }
    [JsonPropertyName("patient_name")] public string? PatientName { get; set; }
    [JsonPropertyName("doctor_id")] public string? DoctorId { get; set; }
    [JsonPropertyName("doctor_name")] public string? DoctorName { get; set; }
    [JsonPropertyName("follow_up_date")] public string? FollowUpDate { get; set; }
    [JsonPropertyName("reason")] public string? Reason { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
}

#endregion
