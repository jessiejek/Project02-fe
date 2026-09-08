// Shared by booking/page.tsx and staff/walk-in/page.tsx — both parse a
// 12-hour slot string ("09:00 AM") from the same fixed SLOTS list into real
// bookings.slot_start_time/slot_end_time values.
export function parseSlotTo24h(slot: string): string {
  const [time, meridiem] = slot.split(" ");
  const [hRaw, m] = time.split(":").map(Number);
  let h = hRaw;
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time24: string, minutes: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
