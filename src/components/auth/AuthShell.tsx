import type { ReactNode } from "react";
import Link from "next/link";
import { VersionFooter } from "@/components/shell/VersionFooter";

export const CLINIC_NAME = "Dr. Grace Gavino Medical Clinic";

//JJQR - AI (Nov 22, 2026) - split layout matched to the desktop app (dark brand panel on the left, form on the right); below lg only the form shows
const HIGHLIGHTS = [
  "Book and manage appointments online",
  "Prescriptions, lab orders and certificates in one place",
  "Secure access for patients, doctors and staff",
];

/**
 * Shared frame for login, registration and password recovery: the clinic name
 * is a quiet brand link home, the h1 states the task, and the form is the
 * only thing competing for attention.
 */
export function AuthShell({ title, description, children, footer, wide = false }: {
  title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <div className="flex flex-1 lg:grid lg:grid-cols-2">
        <aside className="hidden flex-col justify-center gap-md bg-inverse-surface px-[72px] py-xl text-white lg:flex">
          <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-primary-fixed-dim">Clinic portal</p>
          <p className="text-balance text-[38px] font-bold leading-[46px]">{CLINIC_NAME}</p>
          <p className="max-w-[28rem] text-body-lg text-white/75">
            Appointments, consultations, prescriptions and payments for patients, doctors and staff, in one place.
          </p>
          <ul className="mt-sm space-y-sm text-body-md text-white/75">
            {HIGHLIGHTS.map((line) => (
              <li key={line}>✓&nbsp; {line}</li>
            ))}
          </ul>
        </aside>
        <main className="flex flex-1 items-start justify-center px-md py-xl sm:items-center sm:p-lg">
          <div className={wide ? "w-full max-w-auth-wide" : "w-full max-w-auth"}>
            <Link href="/" className="mb-md inline-flex min-h-11 items-center text-body-md font-semibold text-primary hover:underline lg:hidden">
              {CLINIC_NAME}
            </Link>
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg sm:p-xl">
              <div className="mb-lg space-y-xs">
                <h1 className="text-balance text-headline-lg-mobile text-on-surface">{title}</h1>
                {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
              </div>
              {children}
            </div>
            {footer && <div className="mt-md text-center text-body-md text-on-surface-variant">{footer}</div>}
          </div>
        </main>
      </div>
      <VersionFooter />
    </div>
  );
}
