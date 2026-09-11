"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { Role } from "@/lib/nav-config";

export interface AppShellProps {
  role: Role;
  roleBadge?: ReactNode;
  children: ReactNode;
}

const COLLAPSE_KEY = "clinic-sidebar-collapsed";

/**
 * Single shared app shell for all 61 screens (per React-Conversion-Guide.md
 * §5) — replaces every hand-rolled sidebar/topbar block in the original
 * export. Layout is flex-based, not hardcoded margin offsets (§7), and the
 * mobile nav is a real working drawer (§7), not the decorative hamburger
 * found in the source screens.
 */
export function AppShell({ role, roleBadge, children }: AppShellProps) {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  // Icon-only collapse, desktop only. Defaults open; reads the saved
  // preference after mount (each page.tsx renders its own <AppShell>, so
  // this doesn't persist across navigations as component state — it has to
  // round-trip through localStorage instead, same as any other per-viewer
  // UI preference).
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Private browsing / storage blocked — just stay expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — worst case the preference doesn't stick this session.
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — fixed width, flex child (no ml-[260px] math anywhere).
          `sticky top-0 h-screen` pins it to the viewport so Logout (and the
          rest of the nav) never scrolls out of reach on a long page — only
          the nav's own item list scrolls internally if it overflows. */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 md:flex ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
      >
        <Sidebar role={role} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile off-canvas drawer — always full width, collapsing an icon-only
          rail makes no sense on a drawer the user opens on demand and closes
          right after tapping a link. */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
          />
          <div className="relative z-10 h-full w-sidebar max-w-[80vw] shadow-lg">
            <Sidebar role={role} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} roleBadge={roleBadge} />
        <main className="flex-1 bg-background p-md sm:p-lg">
          <div className="mx-auto w-full max-w-content min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
