import { redirect } from "next/navigation";

// Bookings and Queue showed the same "who's here today" list under two
// different vocabularies (scheduling language vs. walk-in language) — folded
// into /staff/queue, the one that actually matches how the clinic runs.
// Kept as a redirect for bookmarks; /staff/bookings/[id] is unaffected.
export default function StaffBookingsRedirect() {
  redirect("/staff/queue");
}
