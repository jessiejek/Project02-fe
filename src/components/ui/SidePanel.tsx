"use client";
//JJQR - AI (Nov 19, 2026) - new file: right-hand editor panel. Esc closes, Ctrl/Cmd+S saves, unsaved-changes guard; full-width sheet below 1024px (iPad portrait).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface SidePanelProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  /** Unsaved edits: closing asks first. */
  dirty?: boolean;
  saving?: boolean;
  /** Read-only panels (system templates) hide Save; use `footer` for their actions. */
  readOnly?: boolean;
  /** Request to close (already confirmed when dirty). */
  onClose: () => void;
  onSave?: () => void;
  /** Non-null = Save is disabled and this reason is shown. */
  saveBlockedReason?: string | null;
  saveLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function SidePanel({ isOpen, title, subtitle, dirty = false, saving = false, readOnly = false, onClose, onSave, saveBlockedReason = null, saveLabel = "Save", footer, children }: SidePanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmOpen(true);
    else onClose();
  }

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (confirmOpen) return; // the confirm dialog owns Esc while it is open
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!readOnly && !saving && !saveBlockedReason) onSave?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestClose only reads the props listed here
  }, [isOpen, confirmOpen, readOnly, saving, saveBlockedReason, onSave, dirty, onClose]);

  useEffect(() => {
    if (!isOpen || !dirty) return;
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isOpen, dirty]);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close editor" onClick={requestClose} className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full flex-col bg-surface-container-lowest shadow-lg outline-none lg:w-[540px]"
      >
        <div className="flex items-start justify-between gap-md border-b border-outline-variant px-lg py-md">
          <div className="min-w-0">
            <h2 className="truncate text-headline-sm text-on-surface">{title}</h2>
            {subtitle && <p className="text-label-md text-on-surface-variant">{subtitle}</p>}
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-lg py-lg">{children}</div>
        <div className="sticky bottom-0 border-t border-outline-variant bg-surface-container-lowest px-lg py-md">
          {!readOnly && saveBlockedReason && (
            <p role="status" className="mb-sm text-label-md text-status-warning">{saveBlockedReason}</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-sm">
            {footer}
            <Button variant="secondary" onClick={requestClose} disabled={saving}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && (
              <Button onClick={() => onSave?.()} loading={saving} disabled={!!saveBlockedReason}>
                {saveLabel}
              </Button>
            )}
          </div>
          {!readOnly && <p className="mt-xs hidden text-right text-label-sm text-on-surface-variant lg:block">Ctrl/⌘+S to save · Esc to close</p>}
        </div>
      </div>
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Discard unsaved changes?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Keep editing</Button>
            <Button variant="danger" onClick={() => { setConfirmOpen(false); onClose(); }}>Discard</Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">You have edits that haven&apos;t been saved. Closing now will lose them.</p>
      </Modal>
    </div>
  );
}
//JJQR - END
