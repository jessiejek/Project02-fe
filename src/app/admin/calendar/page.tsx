import { redirect } from "next/navigation";

// Calendar was a read-only weekly regrouping of the same booking data
// /admin/bookings already listed — folded in there as a List/Week tab
// instead of a separate nav item. Kept as a redirect for bookmarks.
export default function AdminCalendarRedirect() {
  redirect("/admin/bookings");
}
