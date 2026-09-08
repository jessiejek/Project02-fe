"use client";

import { type ReactNode, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";

export interface TopbarProps {
  onMenuClick: () => void;
  /** Doctor's Available/RunningLate/Unavailable badge, or Admin's role badge. */
  roleBadge?: ReactNode;
}

/**
 * Shared topbar for all four roles. The hamburger button here is the fix for
 * the decorative, non-functional icon found in ~28 of the 61 exported
 * screens (Responsive-Analysis.md §2) — it actually opens the mobile drawer.
 */
export function Topbar({ onMenuClick, roleBadge }: TopbarProps) {
  // Controlled locally only — no cross-role search-results feature exists to
  // navigate to, so this stops at "the input actually holds what you type"
  // rather than inventing a new results page. Found unwired during the
  // app-wide decorative-input sweep.
  const [search, setSearch] = useState("");
  const { session } = useSession();
  const initials = session?.displayName
    ? session.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "";
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-lg shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-md">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="shrink-0 rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
        >
          <Icon name="menu" />
        </button>
        <div className="relative hidden min-w-0 max-w-72 flex-1 sm:block">
          <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients, doctors, or appointments..."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-xs pl-xl pr-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-md">
        {roleBadge}
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="notifications" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        </button>
        {session?.displayName && (
          <span className="hidden text-label-md text-on-surface-variant lg:inline">{session.displayName}</span>
        )}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-label-sm text-on-surface-variant">
          {session?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.avatarUrl} alt={session.displayName} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </div>
    </header>
  );
}
