//JJQR - AI (Nov 19, 2026) - the old "Practice settings" page only repeated the sidebar links (Profile, Availability, Templates); it now redirects to Profile so old bookmarks still work.
import { redirect } from "next/navigation";

export default function DoctorSettingsPage() {
  redirect("/doctor/profile");
}
//JJQR - END
