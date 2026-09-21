import Link from "next/link";
import { API_BASE_URL } from "@/lib/api/client";
import { VersionFooter } from "@/components/shell/VersionFooter";

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
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const peso = (n: number) => `₱${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const primaryLink =
  "inline-flex items-center justify-center rounded-lg bg-primary px-lg py-md text-body-md font-medium text-on-primary shadow-sm hover:bg-primary-container";
const secondaryLink =
  "inline-flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest px-lg py-md text-body-md font-medium text-on-surface hover:bg-surface-container-high";

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

  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[56rem] items-center justify-between gap-md px-md py-md">
          <span className="text-body-lg font-semibold text-primary">Dr. Grace Gavino Medical Clinic</span>
          <Link href="/login" className="text-body-md text-on-surface-variant hover:underline">
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[56rem] flex-1 space-y-xl px-md py-xl">
        <section className="space-y-md text-center">
          <h1 className="text-headline-lg text-on-surface">Get your queue number before you arrive</h1>
          <p className="mx-auto max-w-[36rem] text-body-lg text-on-surface-variant">
            Walk in on any open day, or book online first. You are seen in queue order either way.
          </p>
          <div className="flex flex-col items-center justify-center gap-sm sm:flex-row">
            <Link href="/register?next=/patient/bookings" className={primaryLink}>
              Book a visit
            </Link>
            <Link href="/register" className={secondaryLink}>
              Register
            </Link>
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
              <li key={s.n} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label-md text-on-primary">{s.n}</span>
                <p className="mt-sm text-body-lg font-medium text-on-surface">{s.title}</p>
                <p className="mt-xs text-body-md text-on-surface-variant">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-md md:grid-cols-2">
          {hours && (
            <section aria-labelledby="hours" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
              <h2 id="hours" className="text-headline-md text-on-surface">Clinic hours</h2>
              <dl className="mt-md space-y-xs">
                {DAY_ORDER.map((d) => {
                  const h = byDay.get(d);
                  return (
                    <div key={d} className="flex justify-between gap-md text-body-md">
                      <dt className="text-on-surface-variant">{DAYS[d]}</dt>
                      <dd className="text-on-surface">
                        {!h || h.is_closed ? "Closed" : `${fmtTime(h.open_time)} – ${fmtTime(h.close_time)}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          {settings && (
            <section aria-labelledby="fees" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
              <h2 id="fees" className="text-headline-md text-on-surface">Consultation fees</h2>
              <dl className="mt-md space-y-xs">
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
          <section aria-labelledby="find" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
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
