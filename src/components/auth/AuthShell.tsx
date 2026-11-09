import type { ReactNode } from "react";
import Link from "next/link";
import { VersionFooter } from "@/components/shell/VersionFooter";

export const CLINIC_NAME = "Dr. Grace Gavino Medical Clinic";

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
      <main className="flex flex-1 items-start justify-center px-md py-xl sm:items-center sm:p-lg">
        <div className={wide ? "w-full max-w-auth-wide" : "w-full max-w-auth"}>
          <Link href="/" className="mb-md inline-flex min-h-11 items-center text-body-md font-semibold text-primary hover:underline">
            {CLINIC_NAME}
          </Link>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg sm:p-xl">
            <div className="mb-lg space-y-xs">
              <h1 className="text-balance text-headline-lg-mobile text-on-surface">{title}</h1>
              {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-md text-center text-body-md text-on-surface-variant">{footer}</div>}
        </div>
      </main>
      <VersionFooter />
    </div>
  );
}
