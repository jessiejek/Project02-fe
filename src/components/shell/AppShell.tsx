"use client";

import { type ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { Role } from "@/lib/nav-config";

export interface AppShellProps {
  role: Role;
  roleBadge?: ReactNode;
  children: ReactNode;
}

/**
 * Single shared app shell for all 61 screens (per React-Conversion-Guide.md
 * §5) — replaces every hand-rolled sidebar/topbar block in the original
 * export. Layout is flex-based, not hardcoded margin offsets (§7), and the
 * mobile nav is a real working drawer (§7), not the decorative hamburger
 * found in the source screens.
 */
export function AppShell({ role, roleBadge, children }: AppShellProps) {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — fixed width, flex child (no ml-[260px] math anywhere) */}
      <aside className="hidden w-sidebar shrink-0 md:flex">
        <Sidebar role={role} />
      </aside>

      {/* Mobile off-canvas drawer */}
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
