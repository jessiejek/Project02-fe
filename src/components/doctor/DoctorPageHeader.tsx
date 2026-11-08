import type { ReactNode } from "react";

/** A task-first heading shared by the doctor's workspace, not a marketing hero. */
export function DoctorPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-lg">
    <div className="min-w-0 max-w-doctor-heading space-y-xs">
      <h1 className="text-balance text-headline-lg font-semibold tracking-tight text-on-surface">{title}</h1>
      {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-sm">{actions}</div>}
  </header>;
}
