import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

const TONE_ICON: Record<PillTone, string> = {
  success: "check_circle",
  warning: "schedule",
  danger: "cancel",
  info: "info",
  neutral: "radio_button_unchecked",
};

// Every status vocabulary in the app (Patient.md/Staff.md/Doctor.md/admin.md)
// mapped to one tone, so every screen renders the same pill for the same
// status instead of re-deciding the color per screen.
const STATUS_TONE: Record<string, PillTone> = {
  // Booking status — Completed is the only "done" state and is the only one
  // that gets the green success tone; Confirmed/CheckedIn are still-waiting
  // states and share info (blue) so they're never mistaken for Completed at
  // a glance (they used to collide on the same green).
  Pending: "warning",
  ProofSubmitted: "info",
  Confirmed: "info",
  CheckedIn: "info",
  InProgress: "warning",
  OnHold: "warning",
  Cancelled: "danger",
  Completed: "success",
  Expired: "danger",
  NoShow: "danger",
  Rescheduled: "info",
  // Payment status
  Unpaid: "danger",
  Paid: "success",
  Waived: "info",
  Refunded: "danger",
  // Doctor day status
  Available: "success",
  RunningLate: "warning",
  UnavailableToday: "danger",
  // Account / entity status (patients, doctors, staff)
  LinkedAccount: "success",
  NoAccount: "neutral",
  AccountUnknown: "warning",
  Active: "success",
  Inactive: "neutral",
  OnLeave: "warning",
  Invited: "info",
};

export interface StatusPillProps {
  /** A known status string (see STATUS_TONE above) — tone/icon resolve automatically. */
  status?: keyof typeof STATUS_TONE | (string & {});
  /** Override the resolved tone, or set it directly when `status` isn't in the map. */
  tone?: PillTone;
  /** Override the display label (defaults to `status`). */
  label?: string;
  className?: string;
}

/**
 * One status-pill implementation for the whole app (per React-Conversion-Guide.md
 * §5) — covers booking/payment/doctor-day/account-status vocabularies. Always
 * pairs color with an icon, not color alone (Stitch-00 requirement, relevant
 * since this is a clinical context).
 */
export function StatusPill({ status, tone, label, className }: StatusPillProps) {
  const resolvedTone: PillTone = tone ?? (status ? STATUS_TONE[status] : undefined) ?? "neutral";
  const text = label ?? status ?? "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-full border px-3 py-1 text-label-sm uppercase tracking-wider",
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      <Icon name={TONE_ICON[resolvedTone]} className="text-[14px]" />
      {text}
    </span>
  );
}
