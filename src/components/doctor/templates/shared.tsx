"use client";
//JJQR - AI (Nov 19, 2026) - new file: small building blocks shared by the templates tabs
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { LoadStatus } from "@/lib/clinical/useTemplateLibrary";

export const inputCls =
  "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container-low disabled:text-on-surface-variant";
export const labelCls = "mb-xs block text-label-md font-medium text-on-surface";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-xs block text-label-sm text-on-surface-variant">{hint}</span>}
    </label>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full border px-md py-xs text-label-md transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high",
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "system" | "mine"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-sm py-[2px] text-label-sm",
        tone === "system" && "bg-status-info-surface text-status-info",
        tone === "mine" && "bg-status-success-surface text-status-success",
        tone === "neutral" && "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {children}
    </span>
  );
}

/** One card in a list: title row, optional pills, preview text, action row. */
export function ItemCard({ title, pills, preview, actions, onOpen, highlight }: { title: string; pills?: ReactNode; preview?: ReactNode; actions?: ReactNode; onOpen?: () => void; highlight?: boolean }) {
  return (
    <li className={cn("rounded-xl border bg-surface-container-lowest p-md", highlight ? "border-primary ring-2 ring-primary/20" : "border-outline-variant")}>
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-body-md font-semibold text-on-surface">{title}</span>
        </button>
        {pills && <div className="flex shrink-0 items-center gap-xs">{pills}</div>}
      </div>
      {preview && <div className="mt-xs line-clamp-2 text-body-sm text-on-surface-variant">{preview}</div>}
      {actions && <div className="mt-sm flex flex-wrap items-center gap-xs">{actions}</div>}
    </li>
  );
}

export function IconButton({ label, icon, onClick, disabled, tone }: { label: string; icon: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-30",
        tone === "danger" && "hover:text-status-danger",
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

export function TextAction({ children, onClick, disabled, tone }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("min-h-11 rounded-lg px-sm text-label-md hover:bg-surface-container-high disabled:opacity-40", tone === "danger" ? "text-status-danger" : "text-primary")}
    >
      {children}
    </button>
  );
}

export function LoadGate({ status, reload, empty, children, label }: { status: LoadStatus; reload: () => void; empty: boolean; children: ReactNode; label: string }) {
  if (status === "loading" || status === "idle") return <div className="space-y-sm"><SkeletonCard /></div>;
  if (status === "error")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-md rounded-xl border border-status-danger-border bg-status-danger-surface p-md text-status-danger">
        <Icon name="error" />
        <p className="flex-1 text-body-md">Couldn&apos;t load your {label}. The other tabs still work.</p>
        <Button variant="secondary" onClick={reload}>Retry</Button>
      </div>
    );
  if (empty) return null;
  return <>{children}</>;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-outline-variant p-lg text-center text-body-md text-on-surface-variant">{children}</p>;
}

/** "Delete X? You can undo for 5 seconds." */
export function useConfirmDelete(onConfirm: (id: string, label: string) => void) {
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const modal = (
    <Modal
      isOpen={target !== null}
      onClose={() => setTarget(null)}
      title="Delete this item?"
      footer={
        <>
          <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { if (target) onConfirm(target.id, target.label); setTarget(null); }}>Delete</Button>
        </>
      }
    >
      <p className="text-body-md text-on-surface-variant">
        &ldquo;{target?.label}&rdquo; will be removed. You can undo for 5 seconds after deleting.
      </p>
    </Modal>
  );
  return { ask: (id: string, label: string) => setTarget({ id, label }), modal };
}

export const truncate = (text: string | null | undefined, max = 140) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
};

export const NIL_GUID = "00000000-0000-0000-0000-000000000000";
//JJQR - END
