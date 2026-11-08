import type { ReactNode } from "react";

/** Persistent clinical labels; blank examples are never pre-filled medical findings. */
export function ClinicalNoteField({ id, label, hint, value, onChange, tools, required = false }: {
  id: string; label: string; hint: string; value: string; onChange: (value: string) => void; tools: ReactNode; required?: boolean;
}) {
  return <div className={required ? "clinical-note-field sm:col-span-2" : "clinical-note-field"}>
    <div className="mb-sm flex min-h-11 flex-wrap items-center justify-between gap-sm">
      <label htmlFor={id} className="text-body-md font-semibold text-on-surface">{label}{required && <span className="ml-xs text-label-md font-normal text-on-surface-variant">(required)</span>}</label>
      {tools}
    </div>
    <textarea id={id} aria-required={required || undefined} aria-describedby={`${id}-hint`} value={value} onChange={event => onChange(event.target.value)} rows={required ? 2 : 4} className="w-full resize-y border border-outline-variant bg-surface-container-lowest p-md text-body-md leading-relaxed text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
    <p id={`${id}-hint`} className="mt-xs text-label-md text-on-surface-variant">{hint}</p>
  </div>;
}
