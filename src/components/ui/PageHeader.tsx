import type { ReactNode } from "react";

/**
 * Task-first page heading shared by the admin, staff and patient portals
 * (same shape as DoctorPageHeader): a specific title, one line of context,
 * and the page's actions grouped on the right. Wraps instead of truncating.
 */
export function PageHeader({ title, description, actions, eyebrow }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-lg">
      <div className="min-w-0 max-w-page-heading space-y-xs">
        {eyebrow && <div className="text-label-md text-on-surface-variant">{eyebrow}</div>}
        <h1 className="text-balance break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{title}</h1>
        {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-sm">{actions}</div>}
    </header>
  );
}
