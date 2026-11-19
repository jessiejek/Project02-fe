"use client";
//JJQR - AI (Nov 19, 2026) - new file: delete = hide now, show "Deleted · Undo" for 5s, send the real DELETE after 5s. Closing the browser tab inside the window leaves the item intact.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastApi } from "@/components/ui/ToastHost";

export const UNDO_MS = 5000;

export interface UndoableDeleteSpec {
  id: string;
  label: string;
  /** The real API call (runs after the undo window). */
  commit: () => Promise<void>;
  /** Called after a successful commit — drop the row from the list state. */
  afterCommit: () => void;
}

export function useUndoableDelete(toast: ToastApi) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; spec: UndoableDeleteSpec }>());
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  const unhide = useCallback((id: string) => {
    setHidden((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const run = useCallback(async (spec: UndoableDeleteSpec) => {
    try {
      await spec.commit();
      spec.afterCommit();
    } catch {
      toastRef.current.push("error", `Couldn’t delete “${spec.label}”. It was kept.`);
    } finally {
      unhide(spec.id);
    }
  }, [unhide]);

  const deleteWithUndo = useCallback((spec: UndoableDeleteSpec) => {
    if (pending.current.has(spec.id)) return;
    setHidden((prev) => new Set(prev).add(spec.id));
    const timer = setTimeout(() => {
      pending.current.delete(spec.id);
      void run(spec);
    }, UNDO_MS);
    pending.current.set(spec.id, { timer, spec });
    toastRef.current.push("info", `Deleted “${spec.label}”.`, {
      actionLabel: "Undo",
      ttl: UNDO_MS,
      onAction: () => {
        const p = pending.current.get(spec.id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.current.delete(spec.id);
        unhide(spec.id);
        toastRef.current.push("success", `Restored “${spec.label}”.`);
      },
    });
  }, [run, unhide]);

  // Leaving the page (in-app navigation) inside the window finishes the delete the doctor asked for.
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const { timer, spec } of map.values()) {
        clearTimeout(timer);
        void spec.commit().catch(() => undefined);
      }
      map.clear();
    };
  }, []);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);
  return { isHidden, deleteWithUndo };
}
//JJQR - END
