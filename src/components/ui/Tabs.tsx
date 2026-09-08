"use client";

import { useState } from "react";
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

/** Underline-style tab bar (per Stitch-00 Sheet 2) — used by every multi-tab screen (Profile, Patient Detail, Settings, etc). */
export function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id);
  const active = activeId ?? internalActive;

  function handleClick(id: string) {
    setInternalActive(id);
    onChange?.(id);
  }

  return (
    <div className={cn("flex gap-lg overflow-x-auto border-b border-outline-variant", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => handleClick(tab.id)}
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 px-xs py-md text-label-md transition-colors",
            active === tab.id
              ? "border-primary text-primary font-medium"
              : "border-transparent text-on-surface-variant hover:text-on-surface",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
