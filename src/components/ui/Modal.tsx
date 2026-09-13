"use client";

import { type ReactNode, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Dialog max-width — "md" (default, 32rem) for simple forms/confirmations,
   *  "lg" (48rem) for content with its own tab bar or wide tables (e.g.
   *  Patient History) that would otherwise wrap and scroll awkwardly. */
  size?: "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-[32rem]",
  lg: "max-w-[48rem]",
};

/** Modal/dialog shell (header/body/footer) — per Stitch-00 Sheet 2. Closes on Escape or backdrop click. */
export function Modal({ isOpen, onClose, title, children, footer, size = "md" }: ModalProps) {
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
        className={cn("animate-surface-in relative z-10 flex max-h-[90vh] w-full flex-col rounded-xl bg-surface-container-lowest shadow-lg", SIZE_CLASS[size])}
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
