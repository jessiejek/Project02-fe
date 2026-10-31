"use client";

import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { VersionFooter } from "./VersionFooter";
import { AppShellMobileNavProvider } from "./AppShellMobileNavContext";
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
  //JJQR - AI (Oct 31, 2026)
  // Default false for SSR/hydration; read preference after paint (deferred so
  // we do not sync-setState inside the effect body — eslint react-hooks/set-state-in-effect).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
      } catch {
        // Ignore — preference applies on next toggle only.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  //JJQR - END

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

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <AppShellMobileNavProvider closeMobileNav={closeMobileNav}>
    <div className="flex min-h-screen">
      {/* Desktop sidebar — fixed width, flex child (no ml-[260px] math anywhere).
          `sticky top-0 h-screen` pins it to the viewport so Logout (and the
          rest of the nav) never scrolls out of reach on a long page — only
          the nav's own item list scrolls internally if it overflows. */}
      {/* JJQR - AI (Oct 31, 2026) — full sidebar from lg (1024+); below lg use mobile drawer */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 lg:flex ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
      >
        <Sidebar role={role} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile off-canvas drawer — always full width, collapsing an icon-only
          rail makes no sense on a drawer the user opens on demand and closes
          right after tapping a link. */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
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

      {/* JJQR - AI (Oct 31, 2026) — main column offset for fixed consult bottom bar */}
      <div
        className="flex min-h-screen min-w-0 flex-1 flex-col"
        style={
          {
            ["--app-main-left" as string]: collapsed
              ? "var(--spacing-sidebar-collapsed)"
              : "var(--spacing-sidebar)",
          } as CSSProperties
        }
      >
        <Topbar onMenuClick={() => setMobileNavOpen(true)} roleBadge={roleBadge} />
        <main className="flex-1 bg-background p-md sm:p-lg">
          <div className="mx-auto w-full max-w-content min-w-0">{children}</div>
        </main>
        <VersionFooter />
      </div>
    </div>
    </AppShellMobileNavProvider>
  );
}
