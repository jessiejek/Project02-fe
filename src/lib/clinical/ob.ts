//JJQR - AI (Oct 31, 2026)
export type DateOnly = string;

function parseDateOnly(input: DateOnly | string): Date {
  const s = input.trim().slice(0, 10);
  return new Date(`${s}T12:00:00`);
}

function dayDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

export function aogFromLmp(
  lmp: DateOnly | string,
  onDate?: Date,
): { weeks: number; days: number; label: string } {
  const start = parseDateOnly(lmp);
  const end = onDate ?? new Date();
  const total = Math.max(0, dayDiff(start, end));
  const weeks = Math.floor(total / 7);
  const days = total % 7;
  return { weeks, days, label: `${weeks}w ${days}d` };
}

export function eddFromLmp(lmp: DateOnly | string): string {
  const d = parseDateOnly(lmp);
  d.setDate(d.getDate() + 280);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
//JJQR - END
