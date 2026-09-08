import type {
  Patient,
  Doctor,
  Booking,
  Consultation,
  PatientVaccination,
  PatientDocument,
  PatientLabResult,
  Payment,
  PatientSummary,
  Announcement,
  StaffMember,
  ManagedService,
  AuditLog,
  ClinicSettings,
  VitalFieldTemplate,
  PatientVitalReading,
  PrescriptionGroup,
  Medicine,
  DoctorFavoriteMedicine,
  PrescriptionTemplate,
  DoctorScheduleDay,
  OperatingHours,
  SoapPhrase,
  SoapTemplate,
} from "./types";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Builds a full 7-entry schedule from just the active day names, defaulting
// every day (active or not) to 08:00-17:00 — matches doctor_schedules'
// check constraint, which permits inactive rows to hold placeholder times.
function buildSchedule(activeDays: string[]): DoctorScheduleDay[] {
  return WEEK_DAYS.map((day) => ({
    day,
    isActive: activeDays.includes(day),
    startTime: "08:00",
    endTime: "17:00",
  }));
}

export const mockPatient: Patient = {
  id: "p1",
  patientCode: "MF-9821",
  firstName: "Alex",
  middleName: "R.",
  lastName: "Johnson",
  dateOfBirth: "1990-04-12",
  sex: "Male",
  civilStatus: "Single",
  address: "123 Rizal St.",
  city: "Quezon City",
  zipCode: "1100",
  contactNumber: "0917 123 4567",
  email: "alex.j@example.com",
  emergencyContactName: "Maria Johnson",
  emergencyContactNumber: "0917 765 4321",
  emergencyContactRelationship: "Spouse",
  bloodType: "O+",
  philHealthNumber: "12-345678901-2",
  hmoProvider: "Maxicare",
  hmoCardNumber: "MC-00012345",
  isEmailVerified: false,
  consentedAt: undefined,
  consentVersion: 2,
};

export const mockDoctors: Doctor[] = [
  {
    id: "d1",
    name: "Dr. Sarah Chen",
    specialization: "Cardiologist",
    consultationFee: 800,
    bio: "Dr. Chen has 12 years of experience in cardiology, specializing in preventive heart care and diagnostics.",
    rating: 4.9,
    reviewCount: 120,
    dayStatus: "Available",
    services: [
      { id: "s1", name: "Cardiology Consultation", category: "Consultation", price: 800, durationMinutes: 30 },
      { id: "s2", name: "ECG", category: "Diagnostic", price: 500, durationMinutes: 15 },
    ],
    schedule: buildSchedule(["Mon", "Tue", "Wed", "Thu", "Fri"]),
    licenseNumber: "PRC-0123456",
    ptrNumber: "PTR-9988776",
    s2Number: "S2-4455667",
    email: "sarah.chen@gracegavinoclinic.com",
    status: "Active",
    slotDurationMinutes: 30,
  },
  {
    id: "d2",
    name: "Dr. James Wilson",
    specialization: "Pediatrician",
    consultationFee: 600,
    bio: "Dr. Wilson focuses on pediatric wellness and childhood development, with a warm, family-first approach.",
    rating: 4.8,
    reviewCount: 95,
    dayStatus: "RunningLate",
    runningLateMinutes: 15,
    services: [{ id: "s3", name: "Pediatric Wellness Check", category: "Consultation", price: 600, durationMinutes: 30 }],
    schedule: buildSchedule(["Mon", "Wed", "Fri"]),
    licenseNumber: "PRC-0234567",
    ptrNumber: "PTR-8877665",
    s2Number: "S2-3344556",
    email: "james.wilson@gracegavinoclinic.com",
    status: "Active",
    slotDurationMinutes: 30,
  },
  {
    id: "d3",
    name: "Dr. Elena Rodriguez",
    specialization: "Neurologist",
    consultationFee: 900,
    bio: "Dr. Rodriguez specializes in neurological disorders with a focus on migraine management and stroke prevention.",
    rating: 5.0,
    reviewCount: 210,
    dayStatus: "Available",
    services: [{ id: "s4", name: "Neurology Consultation", category: "Consultation", price: 900, durationMinutes: 45 }],
    schedule: buildSchedule(["Tue", "Thu", "Sat"]),
    licenseNumber: "PRC-0345678",
    ptrNumber: "PTR-7766554",
    s2Number: "S2-2233445",
    email: "elena.rodriguez@gracegavinoclinic.com",
    status: "Active",
    slotDurationMinutes: 45,
  },
];

export const mockBookings: Booking[] = [
  {
    id: "b1",
    patientId: "p1",
    patientName: "Alex Johnson",
    patientCode: "MF-9821",
    doctorId: "d1",
    doctorName: "Dr. Sarah Chen",
    serviceNames: ["Cardiology Consultation"],
    appointmentDate: "2026-07-10",
    slotStartTime: "10:30 AM",
    slotEndTime: "11:00 AM",
    status: "Confirmed",
    paymentStatus: "Unpaid",
    paymentMode: "PayAtClinic",
    queueNumber: "A-04",
    totalFee: 800,
    amountDue: 800,
    createdAt: "2026-07-01",
  },
  {
    id: "b2",
    patientId: "p1",
    patientName: "Alex Johnson",
    patientCode: "MF-9821",
    doctorId: "d2",
    doctorName: "Dr. James Wilson",
    serviceNames: ["Pediatric Wellness Check"],
    appointmentDate: "2026-06-18",
    slotStartTime: "09:00 AM",
    slotEndTime: "09:30 AM",
    status: "Completed",
    paymentStatus: "Paid",
    paymentMode: "Online",
    queueNumber: "P-12",
    totalFee: 600,
    amountDue: 0,
    createdAt: "2026-06-10",
  },
  {
    id: "b3",
    patientId: "p2",
    patientName: "Elena Vance",
    patientCode: "MF-4412",
    doctorId: "d3",
    doctorName: "Dr. Elena Rodriguez",
    serviceNames: ["Neurology Consultation"],
    appointmentDate: "2026-06-01",
    slotStartTime: "11:00 AM",
    slotEndTime: "11:45 AM",
    status: "Cancelled",
    paymentStatus: "Refunded",
    paymentMode: "Online",
    totalFee: 900,
    amountDue: 0,
    createdAt: "2026-05-20",
  },
  {
    id: "b4",
    patientId: "p1",
    patientName: "Alex Johnson",
    patientCode: "MF-9821",
    doctorId: "d1",
    doctorName: "Dr. Sarah Chen",
    serviceNames: ["ECG"],
    appointmentDate: "2026-05-15",
    slotStartTime: "02:00 PM",
    slotEndTime: "02:15 PM",
    status: "Completed",
    paymentStatus: "Unpaid",
    paymentMode: "PayAtClinic",
    queueNumber: "A-09",
    totalFee: 500,
    amountDue: 500,
    createdAt: "2026-05-01",
  },
  // Added so every documented booking status has at least one exercisable
  // mock record (previously Pending/ProofSubmitted/CheckedIn/NoShow existed
  // only as code branches, never as data — those screens' states had never
  // actually rendered in a browser).
  {
    id: "b5",
    patientId: "p3",
    patientName: "John Doe",
    patientCode: "MF-2201",
    doctorId: "d3",
    doctorName: "Dr. Elena Rodriguez",
    serviceNames: ["Neurology Consultation"],
    appointmentDate: "2026-07-08",
    slotStartTime: "01:00 PM",
    slotEndTime: "01:45 PM",
    status: "Pending",
    paymentStatus: "Unpaid",
    paymentMode: "PayAtClinic",
    totalFee: 900,
    amountDue: 900,
    createdAt: "2026-07-05",
  },
  {
    id: "b6",
    patientId: "p2",
    patientName: "Elena Vance",
    patientCode: "MF-4412",
    doctorId: "d2",
    doctorName: "Dr. James Wilson",
    serviceNames: ["Pediatric Wellness Check"],
    appointmentDate: "2026-07-09",
    slotStartTime: "10:00 AM",
    slotEndTime: "10:30 AM",
    status: "ProofSubmitted",
    paymentStatus: "Unpaid",
    paymentMode: "Online",
    totalFee: 600,
    amountDue: 600,
    proofType: "ReferenceNumber",
    proofValue: "GC-88213",
    createdAt: "2026-07-06",
  },
  {
    id: "b7",
    patientId: "p1",
    patientName: "Alex Johnson",
    patientCode: "MF-9821",
    doctorId: "d1",
    doctorName: "Dr. Sarah Chen",
    serviceNames: ["Cardiology Consultation"],
    appointmentDate: "2026-07-06",
    slotStartTime: "03:00 PM",
    slotEndTime: "03:30 PM",
    status: "CheckedIn",
    paymentStatus: "Unpaid",
    paymentMode: "PayAtClinic",
    queueNumber: "A-11",
    totalFee: 800,
    amountDue: 800,
    createdAt: "2026-07-02",
  },
  {
    id: "b8",
    patientId: "p2",
    patientName: "Elena Vance",
    patientCode: "MF-4412",
    doctorId: "d2",
    doctorName: "Dr. James Wilson",
    serviceNames: ["Pediatric Wellness Check"],
    appointmentDate: "2026-06-25",
    slotStartTime: "11:30 AM",
    slotEndTime: "12:00 PM",
    status: "NoShow",
    paymentStatus: "Unpaid",
    paymentMode: "PayAtClinic",
    totalFee: 600,
    amountDue: 600,
    createdAt: "2026-06-20",
  },
];

export const mockConsultations: Consultation[] = [
  {
    id: "c0",
    bookingId: "b4",
    patientId: "p1",
    doctorName: "Dr. Sarah Chen",
    appointmentDate: "2026-05-15",
    chiefComplaint: "Follow-up for hypertension",
    subjective: "Patient reports occasional headaches, otherwise well.",
    objective: "BP mildly elevated. No acute distress.",
    assessment: "Essential hypertension, controlled.",
    plan: "Continue current medication, recheck BP in 2 months.",
    diagnoses: [{ code: "I10", description: "Essential hypertension", type: "Primary" }],
    feeDecision: { type: "Charge", amount: 800, paymentMode: "PayAtClinic" },
    followUpDate: "2026-07-15",
    followUpReason: "Blood pressure recheck",
    followUpInstructions: "Recheck blood pressure.",
    followUpReminder: true,
  },
  {
    id: "c1",
    bookingId: "b2",
    patientId: "p1",
    doctorName: "Dr. James Wilson",
    appointmentDate: "2026-06-18",
    chiefComplaint: "Annual wellness check",
    subjective: "Patient reports feeling well, no complaints.",
    objective: "Vitals within normal range. BP 118/76, HR 72.",
    assessment: "Healthy, age-appropriate development.",
    plan: "Continue routine checkups annually.",
    diagnoses: [{ code: "Z00.0", description: "General health examination", type: "Primary" }],
    labOrders: [{ testName: "Complete Blood Count", reason: "Routine annual screening", specimenType: "Blood" }],
    feeDecision: { type: "Charge", amount: 600, paymentMode: "PayAtClinic" },
    followUpDate: "2027-06-18",
    followUpReason: "Annual physical",
    followUpInstructions: "Return for annual wellness check.",
    followUpReminder: true,
  },
];

// SOAP speed tooling, scoped to "d1" (the mock doctor's id — real identity is
// now resolved via SessionProvider/staff_accounts, but this mock domain data
// hasn't migrated off the "d1" convention yet), mirroring mockDoctorFavorites'
// scoping exactly.
export const mockSoapPhrases: SoapPhrase[] = [
  { id: "sp1", doctorId: "d1", field: "objective", label: "Normal Cardiac Exam", text: "Regular rate and rhythm, no murmurs, rubs, or gallops." },
  { id: "sp2", doctorId: "d1", field: "objective", label: "Normal Lung Exam", text: "Clear breath sounds bilaterally, no wheezes, rales, or rhonchi." },
  { id: "sp3", doctorId: "d1", field: "subjective", label: "No New Complaints", text: "Patient reports feeling well, no new complaints since last visit." },
  { id: "sp4", doctorId: "d1", field: "assessment", label: "Well-Controlled", text: "Condition well-controlled on current regimen." },
  { id: "sp5", doctorId: "d1", field: "plan", label: "Continue + Follow-up", text: "Continue current medications as prescribed. Follow up in 2 months or sooner if symptoms worsen." },
];

// One marked isSystemTemplate (a clinic-wide default every doctor can use,
// hides edit/delete) — same pattern as mockPrescriptionTemplates.
export const mockSoapTemplates: SoapTemplate[] = [
  {
    id: "st1",
    doctorId: "d1",
    title: "Annual Physical — Normal",
    isSystemTemplate: true,
    chiefComplaint: "Annual physical examination.",
    subjective: "Patient reports feeling well, no new complaints.",
    objective: "Vitals within normal range. Alert and oriented, no acute distress. Heart regular rate and rhythm. Lungs clear bilaterally.",
    assessment: "Healthy, age-appropriate.",
    plan: "Continue routine health maintenance. Return in 1 year or sooner if concerns arise.",
  },
  {
    id: "st2",
    doctorId: "d1",
    title: "URTI Follow-up",
    chiefComplaint: "Follow-up for upper respiratory infection.",
    subjective: "Patient reports improvement in symptoms since last visit.",
    objective: "No fever. Throat clear, no erythema. Lungs clear bilaterally.",
    assessment: "Upper respiratory infection, resolving.",
    plan: "Complete remaining course of antibiotics if prescribed. Return if symptoms worsen or fail to resolve.",
  },
];

// clinic-vitals-fe.md's 7 standard "design templates" (isDefault: true),
// plus a couple of example custom ones a doctor can add via the Others
// modal (isDefault: false). Note the reference model has no pain-score
// field and stores blood pressure as ONE combined value (e.g. "128/82"),
// not separate systolic/diastolic numbers — a real, deliberate departure
// from the old flat ConsultationVitals shape, not an oversight.
export const mockVitalFieldTemplates: VitalFieldTemplate[] = [
  { id: "vt1", description: "TEMPERATURE", formKey: "temperature", unit: "°C", icon: "thermometer", isDefault: true },
  { id: "vt2", description: "PULSE RATE", formKey: "pulse_rate", unit: "bpm", icon: "heart_pulse", isDefault: true },
  { id: "vt3", description: "RESPIRATORY RATE", formKey: "respiratory_rate", unit: "rpm", icon: "lungs", isDefault: true },
  { id: "vt4", description: "BLOOD PRESSURE", formKey: "blood_pressure", unit: "mmHg", icon: "gauge", isDefault: true },
  { id: "vt5", description: "O2 SATURATION", formKey: "o2_saturation", unit: "%", icon: "wind", isDefault: true },
  { id: "vt6", description: "HEIGHT", formKey: "height", unit: "cm", icon: "ruler", isDefault: true },
  { id: "vt7", description: "WEIGHT", formKey: "weight", unit: "kg", icon: "weight_scale", isDefault: true },
  { id: "vt8", description: "Fundal Height", formKey: "fundal_height", unit: "", icon: "ruler", isDefault: false },
  { id: "vt9", description: "Fetal Heart Rate", formKey: "fetal_heart_rate", unit: "", icon: "heart_pulse", isDefault: false },
];

// Seeded from the two consultations' previously-flat vitals (b4 = c0's
// booking, b2 = c1's booking), converted to one row per template.
export const mockVitalReadings: PatientVitalReading[] = [
  { id: "vr1", bookingId: "b4", patientId: "p1", templateId: "vt1", value: "36.7", recordedAt: "2026-05-15" },
  { id: "vr2", bookingId: "b4", patientId: "p1", templateId: "vt2", value: "78", recordedAt: "2026-05-15" },
  { id: "vr3", bookingId: "b4", patientId: "p1", templateId: "vt3", value: "18", recordedAt: "2026-05-15" },
  { id: "vr4", bookingId: "b4", patientId: "p1", templateId: "vt4", value: "128/82", recordedAt: "2026-05-15" },
  { id: "vr5", bookingId: "b4", patientId: "p1", templateId: "vt5", value: "97", recordedAt: "2026-05-15" },
  { id: "vr6", bookingId: "b4", patientId: "p1", templateId: "vt6", value: "175", recordedAt: "2026-05-15" },
  { id: "vr7", bookingId: "b4", patientId: "p1", templateId: "vt7", value: "71", recordedAt: "2026-05-15" },
  { id: "vr8", bookingId: "b2", patientId: "p1", templateId: "vt1", value: "36.8", recordedAt: "2026-06-18" },
  { id: "vr9", bookingId: "b2", patientId: "p1", templateId: "vt2", value: "72", recordedAt: "2026-06-18" },
  { id: "vr10", bookingId: "b2", patientId: "p1", templateId: "vt3", value: "16", recordedAt: "2026-06-18" },
  { id: "vr11", bookingId: "b2", patientId: "p1", templateId: "vt4", value: "118/76", recordedAt: "2026-06-18" },
  { id: "vr12", bookingId: "b2", patientId: "p1", templateId: "vt5", value: "98", recordedAt: "2026-06-18" },
  { id: "vr13", bookingId: "b2", patientId: "p1", templateId: "vt6", value: "175", recordedAt: "2026-06-18" },
  { id: "vr14", bookingId: "b2", patientId: "p1", templateId: "vt7", value: "70", recordedAt: "2026-06-18" },
];

// Medicine search/autocomplete catalog for the "New Prescription" tab.
export const mockMedicines: Medicine[] = [
  { id: "m1", genericName: "PARACETAMOL 500MG TAB" },
  { id: "m2", genericName: "AMOXICILLIN + CLAVULANIC ACID (CO-AMOXICLAV) 500MG TAB" },
  { id: "m3", genericName: "CEFIXIME 200MG TAB" },
  { id: "m4", genericName: "LOPERAMIDE 2MG CAP" },
  { id: "m5", genericName: "MEFENAMIC ACID 500MG TAB" },
  { id: "m6", genericName: "CETIRIZINE 10MG TAB" },
  { id: "m7", genericName: "OMEPRAZOLE 20MG CAP" },
  { id: "m8", genericName: "METFORMIN 500MG TAB" },
  { id: "m9", genericName: "LOSARTAN 50MG TAB" },
  { id: "m10", genericName: "ASCORBIC ACID + MULTIVITAMINS 500MG TAB" },
  { id: "m11", genericName: "SALBUTAMOL 2MG/5ML SYRUP" },
  { id: "m12", genericName: "AMLODIPINE 5MG TAB" },
  { id: "m13", genericName: "AZITHROMYCIN 500MG TAB" },
  { id: "m14", genericName: "IBUPROFEN 400MG TAB" },
  { id: "m15", genericName: "SIMVASTATIN 20MG TAB" },
];

// One group per visit (replaces mockPrescriptions + c1's inline
// prescriptionItems) — clinic-prescriptions-fe.md's saved prescription group.
export const mockPrescriptionGroups: PrescriptionGroup[] = [
  {
    id: "rxg1",
    patientId: "p1",
    doctorId: "d2",
    bookingId: "b2",
    createdAt: "2026-06-18",
    items: [
      {
        id: "rxi1",
        rxId: "m10",
        genericName: "ASCORBIC ACID + MULTIVITAMINS 500MG TAB",
        dosage: "1",
        quantity: "30",
        instruction: "Once daily after breakfast",
      },
    ],
  },
];

// Single-medicine reuse shortcuts, scoped to "d1" (the mock doctor's id —
// this mock domain data hasn't migrated off the "d1" convention yet).
export const mockDoctorFavorites: DoctorFavoriteMedicine[] = [
  {
    id: "fav1",
    doctorId: "d1",
    item: { id: "favi1", rxId: "m1", genericName: "PARACETAMOL 500MG TAB", dosage: "2", quantity: "7", instruction: "After Meal as needed" },
  },
  {
    id: "fav2",
    doctorId: "d1",
    item: {
      id: "favi2",
      rxId: "m2",
      genericName: "AMOXICILLIN + CLAVULANIC ACID (CO-AMOXICLAV) 500MG TAB",
      dosage: "1",
      quantity: "14",
      instruction: "Before Meal",
    },
  },
];

// One marked isSystemTemplate (hides edit/delete, per clinic-prescriptions-fe.md §2).
export const mockPrescriptionTemplates: PrescriptionTemplate[] = [
  {
    id: "tpl1",
    doctorId: "d1",
    title: "Medical Certificate",
    isSystemTemplate: true,
    items: [
      { id: "tpli1", rxId: "m1", genericName: "PARACETAMOL 500MG TAB", dosage: "2", quantity: "10", instruction: "After Meal as needed for fever" },
    ],
  },
  {
    id: "tpl2",
    doctorId: "d1",
    title: "URTI Standard",
    items: [
      { id: "tpli2", rxId: "m13", genericName: "AZITHROMYCIN 500MG TAB", dosage: "1", quantity: "3", instruction: "Once daily after meal" },
      { id: "tpli3", rxId: "m6", genericName: "CETIRIZINE 10MG TAB", dosage: "1", quantity: "7", instruction: "Once daily at bedtime" },
    ],
  },
];

export const mockVaccinations: PatientVaccination[] = [
  {
    id: "v1",
    patientId: "p1",
    vaccineName: "Influenza",
    doseNumber: 1,
    administeredDate: "2026-01-15",
    status: "Administered",
    source: "AdministeredInClinic",
  },
  {
    id: "v2",
    patientId: "p1",
    vaccineName: "Tetanus",
    doseNumber: 2,
    administeredDate: "2025-08-02",
    status: "Administered",
    source: "PatientReported",
  },
];

export const mockDocuments: PatientDocument[] = [
  {
    id: "doc1",
    patientId: "p1",
    bookingId: "b2",
    fileName: "wellness-check-notes.pdf",
    title: "Wellness Check Notes",
    uploadedAt: "2026-06-18",
  },
];

export const mockLabResults: PatientLabResult[] = [
  {
    id: "lab1",
    patientId: "p1",
    bookingId: "b4",
    fileName: "ecg-result.pdf",
    resultTitle: "ECG Result",
    status: "Completed",
    uploadedAt: "2026-05-15",
  },
];

// Staff.md mock data

export const mockPayments: Payment[] = [
  { id: "pay1", bookingId: "b4", amount: 500, status: "Unpaid" },
  { id: "pay2", bookingId: "b2", amount: 600, paymentMethod: "GCash", orNumber: "OR-1002", status: "Paid" },
];

export const mockPatientSummaries: PatientSummary[] = [
  {
    id: "p1",
    patientCode: "MF-9821",
    fullName: "Alex Johnson",
    sex: "Male",
    dateOfBirth: "1990-04-12",
    contactNumber: "0917 123 4567",
    email: "alex.j@example.com",
    accountStatus: "LinkedAccount",
  },
  {
    id: "p2",
    patientCode: "MF-4412",
    fullName: "Elena Vance",
    sex: "Female",
    dateOfBirth: "1985-11-02",
    contactNumber: "0917 555 1122",
    email: "elena.v@example.com",
    accountStatus: "NoAccount",
  },
  {
    id: "p3",
    patientCode: "MF-2201",
    fullName: "John Doe",
    sex: "Male",
    dateOfBirth: "1978-02-20",
    contactNumber: "0917 888 9900",
    email: "john.doe@example.com",
    accountStatus: "AccountUnknown",
  },
];

export const mockAnnouncements: Announcement[] = [
  {
    id: "a1",
    title: "Holiday Schedule Update",
    body: "The clinic will observe modified hours during the upcoming holiday week. Please check the schedule board for details.",
    postedDate: "2026-06-20",
    postedBy: "Admin",
    isActive: true,
  },
  {
    id: "a2",
    title: "New Cardiology Wing Opening",
    body: "We're excited to announce the opening of our new cardiology wing, effective next month.",
    postedDate: "2026-06-01",
    postedBy: "Admin",
    isActive: true,
  },
];

export const mockStaff: StaffMember[] = [
  { id: "st1", fullName: "Jordan Reyes", email: "jordan.reyes@clinic.com", role: "Staff", status: "Active" },
  { id: "st2", fullName: "Priya Santos", email: "priya.santos@clinic.com", role: "Staff", status: "Invited" },
];

// admin.md mock data

export const mockServices: ManagedService[] = [
  { id: "s1", name: "Cardiology Consultation", category: "Consultation", price: 800, isActive: true, doctorNames: ["Dr. Sarah Chen"] },
  { id: "s2", name: "ECG", category: "Diagnostic", price: 500, isActive: true, doctorNames: ["Dr. Sarah Chen"] },
  { id: "s3", name: "Pediatric Wellness Check", category: "Consultation", price: 600, isActive: true, doctorNames: ["Dr. James Wilson"] },
  { id: "s4", name: "Neurology Consultation", category: "Consultation", price: 900, isActive: false, doctorNames: ["Dr. Elena Rodriguez"] },
];

export const mockAuditLogs: AuditLog[] = [
  { id: "log1", timestamp: "2026-07-01 09:15", entityType: "Payment", entityId: "pay2", action: "Payment Confirmed", performedBy: "Jordan Reyes", details: "GCash, OR-1002" },
  { id: "log2", timestamp: "2026-06-20 14:02", entityType: "Booking", entityId: "b3", action: "Booking Cancelled", performedBy: "Alex Johnson", details: "Patient self-cancel" },
  { id: "log3", timestamp: "2026-06-18 10:30", entityType: "Consultation", entityId: "c1", action: "Consultation Completed", performedBy: "Dr. James Wilson" },
];

export const mockSettings: ClinicSettings = {
  clinicName: "Dr. Grace Gavino Medical Clinic",
  address: "123 Rizal St., Quezon City",
  contactNumber: "(02) 8123 4567",
  email: "info@gracegavinoclinic.com",
  description: "A modern, patient-first clinic offering cardiology, pediatrics, and neurology services.",
  defaultPaymentMode: "PayAtClinic",
  acceptedPaymentMethods: ["Cash", "GCash", "Maya", "BankTransfer"],
  refundPolicy: "Refunds are processed within 5-7 business days.",
  consentVersion: 2,
  primaryColor: "#00685f",
  secondaryColor: "#565e74",
  privacyPolicyText: "We collect only the information needed to provide safe, accurate care, and never share it with third parties without consent.",
  websiteUrl: "https://gracegavinoclinic.com",
};

// Matches clinic_operating_hours (schema.sql) — admin/settings' Hours tab
// previously had no backing data at all, found during the decorative-input
// sweep; Sunday closed, Saturday half-day, matching the schema's own seed.
export const mockOperatingHours: OperatingHours[] = [
  { day: "Sun", isClosed: true, openTime: "", closeTime: "" },
  { day: "Mon", isClosed: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Tue", isClosed: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Wed", isClosed: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Thu", isClosed: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Fri", isClosed: false, openTime: "08:00", closeTime: "17:00" },
  { day: "Sat", isClosed: false, openTime: "08:00", closeTime: "12:00" },
];
