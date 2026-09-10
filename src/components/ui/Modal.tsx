"use client";

import { type ReactNode, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Modal/dialog shell (header/body/footer) — per Stitch-00 Sheet 2. Closes on Escape or backdrop click. */
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="animate-scrim-in absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
      />
      {/* §12 apple-design: the surface materialises (scale + fade), not an instant pop. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-surface-in relative z-10 flex max-h-[90vh] w-full max-w-[32rem] flex-col rounded-xl bg-surface-container-lowest shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <h2 className="text-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-lg py-lg">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-sm border-t border-outline-variant px-lg py-md sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
