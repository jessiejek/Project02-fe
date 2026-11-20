"use client";
//JJQR - AI (Nov 19, 2026) - new file: stacked toasts that auto-dismiss and can carry an action (Undo). Existing <Toast> supplies the look.
import { useCallback, useEffect, useRef, useState } from "react";
import { Toast, type ToastVariant } from "@/components/ui/Toast";

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  ttl: number;
}

export interface ToastApi {
  push: (variant: ToastVariant, message: string, opts?: { actionLabel?: string; onAction?: () => void; ttl?: number }) => number;
  dismiss: (id: number) => void;
}

export function useToastQueue(): { items: ToastItem[]; api: ToastApi } {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const push = useCallback<ToastApi["push"]>((variant, message, opts) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-3), { id, variant, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction, ttl: opts?.ttl ?? (variant === "error" ? 8000 : 4000) }]);
    return id;
  }, []);
  return { items, api: { push, dismiss } };
}

function Row({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.ttl);
    return () => clearTimeout(t);
  }, [item.id, item.ttl, dismiss]);
  return (
    <div className="pointer-events-auto">
      <Toast
        variant={item.variant}
        message={item.message}
        actionLabel={item.actionLabel}
        onAction={item.onAction ? () => { item.onAction?.(); dismiss(item.id); } : undefined}
      />
    </div>
  );
}

export function ToastHost({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  //JJQR Nov 20, 2026 - max-w-md resolves to --spacing-md (16px) in this theme, which squeezed toasts into a narrow column; use explicit arbitrary widths
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex w-max min-w-[min(92vw,320px)] max-w-[min(92vw,480px)] -translate-x-1/2 flex-col gap-sm">
      {items.map((t) => <Row key={t.id} item={t} dismiss={dismiss} />)}
    </div>
  );
}
//JJQR - END
