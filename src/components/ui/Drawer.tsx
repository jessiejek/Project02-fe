"use client";

import { type ReactNode, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Slide-in panel from the right (e.g. doctor's "View Patient History").
 * Desktop: ~40% width, per the original spec. Mobile: full-screen — the
 * original export never defined a mobile variant for this (Responsive-
 * Analysis.md §3/§7); this is that fix.
 */
export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
      />
      <div className="relative z-10 flex h-full w-full flex-col bg-surface-container-lowest shadow-lg md:w-[40%] md:min-w-[420px]">
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
      </div>
    </div>
  );
}
