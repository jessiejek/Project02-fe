import { redirect } from "next/navigation";

// The diagnosis-templates screen was folded into /doctor/settings, which now
// manages every kind of doctor template. Kept as a redirect for bookmarks.
export default function DoctorTemplatesRedirect() {
  redirect("/doctor/settings");
}
