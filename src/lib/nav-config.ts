export type Role = "patient" | "staff" | "doctor" | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Material Symbols Outlined ligature name
}

export interface NavGroup {
  /** Section heading, e.g. admin's "OPERATIONS" / "MANAGEMENT" / "SYSTEM". Omit for a flat list. */
  label?: string;
  items: NavItem[];
}

export interface RoleConfig {
  role: Role;
  /** Small caption under the brand name in the sidebar, e.g. "Patient Portal". */
  subtitle: string;
  /** Tailwind color token name (from globals.css @theme) used for this role's active-nav accent. */
  accent: "primary" | "secondary" | "on-secondary-fixed" | "tertiary";
  navGroups: NavGroup[];
}

// Nav items per Stitch-00 Sheet 3 (patient/staff/doctor) and Stitch-04 (admin's
// grouped OPERATIONS/MANAGEMENT/SYSTEM sidebar). Routes are placeholders until
// each screen is converted in Phases C-F.
export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  patient: {
    role: "patient",
    subtitle: "Patient Portal",
    accent: "primary",
    navGroups: [
      {
        items: [
          { label: "Dashboard", href: "/patient/dashboard", icon: "dashboard" },
          { label: "Your Doctor", href: "/patient/doctors", icon: "medical_services" },
          { label: "My Bookings", href: "/patient/bookings", icon: "event_available" },
          { label: "Medical Records", href: "/patient/medical-records", icon: "assignment" },
          { label: "Prescriptions", href: "/patient/prescriptions", icon: "prescriptions" },
          { label: "Vaccinations", href: "/patient/vaccinations", icon: "vaccines" },
          { label: "Documents", href: "/patient/documents", icon: "description" },
          { label: "Profile", href: "/patient/profile", icon: "person" },
        ],
      },
    ],
  },
  staff: {
    role: "staff",
    subtitle: "Staff Terminal",
    accent: "secondary",
    navGroups: [
      {
        items: [
          { label: "Dashboard", href: "/staff/dashboard", icon: "dashboard" },
          { label: "Payments", href: "/staff/payments", icon: "payments" },
          { label: "Walk-In", href: "/staff/walk-in", icon: "directions_walk" },
          { label: "Queue", href: "/staff/queue", icon: "list_alt" },
          { label: "Patients", href: "/staff/patients", icon: "group" },
          { label: "Doctor Status", href: "/staff/doctor-status", icon: "medical_services" },
          { label: "Announcements", href: "/staff/announcements", icon: "campaign" },
          { label: "Profile", href: "/staff/profile", icon: "manage_accounts" },
        ],
      },
    ],
  },
  doctor: {
    role: "doctor",
    subtitle: "Medical Practitioner",
    accent: "on-secondary-fixed",
    navGroups: [
      {
        items: [
          { label: "Dashboard", href: "/doctor/dashboard", icon: "dashboard" },
          { label: "My Visits", href: "/doctor/appointments", icon: "event_note" },
          { label: "Patients", href: "/doctor/patients", icon: "groups" },
          { label: "Schedule", href: "/doctor/schedule", icon: "schedule" },
          { label: "Settings", href: "/doctor/settings", icon: "settings" },
          { label: "Profile", href: "/doctor/profile", icon: "account_circle" },
        ],
      },
    ],
  },
  admin: {
    role: "admin",
    subtitle: "Clinic Administration",
    accent: "tertiary",
    navGroups: [
      {
        label: "Operations",
        items: [
          { label: "Dashboard", href: "/admin/dashboard", icon: "dashboard" },
          { label: "Bookings", href: "/admin/bookings", icon: "calendar_today" },
          { label: "Walk-In", href: "/admin/walk-in", icon: "directions_walk" },
        ],
      },
      {
        label: "Management",
        items: [
          { label: "Doctors", href: "/admin/doctors", icon: "medical_services" },
          { label: "Patients", href: "/admin/patients", icon: "group" },
          { label: "Staff", href: "/admin/staff", icon: "badge" },
          { label: "Announcements", href: "/admin/announcements", icon: "campaign" },
        ],
      },
      {
        label: "System",
        items: [
          { label: "Settings", href: "/admin/settings", icon: "settings" },
          { label: "Audit Logs", href: "/admin/audit-logs", icon: "history" },
          { label: "Reports", href: "/admin/reports", icon: "monitoring" },
        ],
      },
    ],
  },
};
