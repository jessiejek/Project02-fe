import { RefreshButton } from "@/components/ui/RefreshButton";
import { buttonStyles } from "@/components/ui/buttonStyles";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api/client";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { CLINIC_NAME } from "@/components/auth/AuthShell";
import { cn } from "@/lib/cn";

interface Settings {
  address: string;
  contact_number: string | null;
  fee_consultation: number;
  fee_follow_up: number;
  fee_senior_pwd: number;
  fee_med_cert: number;
}
interface OperatingHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

async function load<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function fmtTime(t: string | null) {
  if (!t) return "Not provided";
  const [h, m] = t.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return "Not provided";
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const peso = (n: number) => Number.isFinite(n) ? `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}` : "Not provided";

const primaryLink = buttonStyles("primary", "px-xl");
const secondaryLink = buttonStyles("ghost");
const panel = "rounded-xl border border-outline-variant bg-surface-container-lowest p-lg";
/** Day of week in the clinic's own timezone (Asia/Manila, UTC+8, no DST). */
const manilaDay = () => new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCDay();

const STEPS = [
  { n: "1", title: "Create an account", body: "Sign up once with your name, birth date and email." },
  { n: "2", title: "Book a day", body: "Pick the day you want to come in. You get a queue number right away, no time slot to fight for." },
  { n: "3", title: "Show up", body: "Tell the front desk you're here and they check you in. You're seen in queue order, same as walk-ins." },
];

// Public front door: what the clinic is, when it's open, what it costs, and how to book.
export default async function Home() {
  const [settings, hours] = await Promise.all([
    load<Settings>("/api/settings"),
    load<OperatingHour[]>("/api/admin/operating-hours"),
  ]);
  const byDay = new Map((hours ?? []).map((h) => [h.day_of_week, h]));
  const today = manilaDay();

  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-public items-center justify-between gap-md px-md py-sm">
          <Link href="/" className="min-w-0 text-body-lg font-semibold text-primary">{CLINIC_NAME}</Link>
          <Link href="/login" className={buttonStyles("secondary", "shrink-0 whitespace-nowrap px-md py-sm")}>
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-public flex-1 space-y-xl px-md py-xl">
        <section className="space-y-md py-lg text-center">
          <h1 className="mx-auto max-w-copy text-balance text-headline-lg-mobile text-on-surface sm:text-headline-lg">Get your queue number before you arrive</h1>
          <p className="mx-auto max-w-copy text-pretty text-body-lg text-on-surface-variant">
            Walk in on any open day, or book online first. You are seen in queue order either way.
          </p>
          <div className="flex flex-col items-center justify-center gap-sm sm:flex-row">
            <Link href="/register?next=/patient/bookings" className={primaryLink}>
              Book a visit
            </Link>
            <a href="#how" className={secondaryLink}>
              How booking works
            </a>
          </div>
          <p className="text-label-md text-on-surface-variant">
            Already a patient?{" "}
            <Link href="/login?next=/patient/bookings" className="text-primary hover:underline">
              Log in to book
            </Link>
          </p>
        </section>

        <section aria-labelledby="how" className="space-y-md">
          <h2 id="how" className="text-headline-md text-on-surface">How booking works</h2>
          <ol className="grid gap-md sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className={panel}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-label-md font-semibold tabular-nums text-primary">{s.n}</span>
                <p className="mt-sm text-body-lg font-medium text-on-surface">{s.title}</p>
                <p className="mt-xs text-body-md text-on-surface-variant">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {(!settings || !hours?.length) && (
          <section role="status" className={cn(panel, "space-y-md")}>
            <h2 className="text-headline-md text-on-surface">Some clinic details are unavailable</h2>
            <p className="text-body-md text-on-surface-variant">{!hours?.length && "Clinic hours are unavailable. "}{!settings && "Fees and contact details are unavailable. "}Please confirm these details before your visit.</p>
            <RefreshButton />
          </section>
        )}

        <div className="grid gap-md md:grid-cols-2">
          {hours && hours.length > 0 && (
            <section aria-labelledby="hours" className={panel}>
              <h2 id="hours" className="text-headline-md text-on-surface">Clinic hours</h2>
              <dl className="mt-md">
                {DAY_ORDER.map((d) => {
                  const h = byDay.get(d);
                  const isToday = d === today;
                  return (
                    <div key={d} aria-current={isToday ? "date" : undefined}
                      className={cn("-mx-sm flex justify-between gap-md rounded-md px-sm py-xs text-body-md", isToday && "bg-primary/10 font-medium")}>
                      <dt className={isToday ? "text-primary" : "text-on-surface-variant"}>{DAYS[d]}{isToday && <span className="sr-only"> (today)</span>}</dt>
                      <dd className="text-right text-on-surface">
                        {!h ? "Not provided" : h.is_closed ? "Closed" : h.open_time && h.close_time ? `${fmtTime(h.open_time)} – ${fmtTime(h.close_time)}` : "Not provided"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          {settings && (
            <section aria-labelledby="fees" className={panel}>
              <h2 id="fees" className="text-headline-md text-on-surface">Consultation fees</h2>
              <dl className="mt-md space-y-sm">
                <div className="flex justify-between gap-md text-body-md">
                  <dt className="text-on-surface-variant">New consultation</dt>
                  <dd className="text-on-surface">{peso(settings.fee_consultation)}</dd>
                </div>
                <div className="flex justify-between gap-md text-body-md">
                  <dt className="text-on-surface-variant">Follow-up</dt>
                  <dd className="text-on-surface">{peso(settings.fee_follow_up)}</dd>
                </div>
                <div className="flex justify-between gap-md text-body-md">
                  <dt className="text-on-surface-variant">Senior / PWD</dt>
                  <dd className="text-on-surface">{peso(settings.fee_senior_pwd)}</dd>
                </div>
                <div className="flex justify-between gap-md text-body-md">
                  <dt className="text-on-surface-variant">Medical certificate (add-on)</dt>
                  <dd className="text-on-surface">+{peso(settings.fee_med_cert)}</dd>
                </div>
              </dl>
              <p className="mt-md text-label-md text-on-surface-variant">Paid at the clinic after your visit.</p>
            </section>
          )}
        </div>

        {settings && (
          <section aria-labelledby="find" className={panel}>
            <h2 id="find" className="text-headline-md text-on-surface">Find us</h2>
            <p className="mt-sm text-body-md text-on-surface">{settings.address}</p>
            {settings.contact_number && (
              <p className="mt-xs text-body-md text-on-surface-variant">
                Call{" "}
                <a href={`tel:${settings.contact_number}`} className="text-primary hover:underline">
                  {settings.contact_number}
                </a>
              </p>
            )}
          </section>
        )}
      </main>

      <VersionFooter />
    </div>
  );
}
