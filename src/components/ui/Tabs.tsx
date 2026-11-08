"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled active tab id. Omit to let Tabs manage its own state (defaults to the first tab). */
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/** Underline-style tab bar (per Stitch-00 Sheet 2) — used by every multi-tab screen
 *  (Profile, Patient Detail, Settings, etc). The active underline slides between
 *  tabs (apple-design §7: spatial consistency) instead of jumping. */
export function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id);
  const active = activeId ?? internalActive;

  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    function measure() {
      const el = btnRefs.current[active ?? ""];
      if (!el) return;
      setIndicator(previous => previous?.left === el.offsetLeft && previous.width === el.offsetWidth ? previous : { left: el.offsetLeft, width: el.offsetWidth });
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const el of Object.values(btnRefs.current)) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [active, tabs]);

  function handleClick(id: string) {
    setInternalActive(id);
    onChange?.(id);
  }

  return (
    <div ref={containerRef} role="tablist" aria-label="Sections" className={cn("relative flex gap-lg overflow-x-auto border-b border-outline-variant", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            btnRefs.current[tab.id] = el;
          }}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onKeyDown={(event) => {
            const index = tabs.findIndex(item => item.id === tab.id);
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
            if (next >= 0) { event.preventDefault(); handleClick(tabs[next].id); btnRefs.current[tabs[next].id]?.focus(); }
          }}
          onClick={() => handleClick(tab.id)}
          className={cn(
            "shrink-0 whitespace-nowrap px-xs py-md text-label-md transition-colors duration-150",
            active === tab.id ? "text-primary font-medium" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {tab.label}
        </button>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-1px] h-[2px] rounded-full bg-primary transition-[left,width,opacity] duration-300 ease-[var(--ease-out-quart)] motion-reduce:transition-none"
        style={{
          left: indicator?.left ?? 0,
          width: indicator?.width ?? 0,
          opacity: indicator ? 1 : 0,
        }}
      />
    </div>
  );
}
