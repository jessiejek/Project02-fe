"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { ROLE_CONFIG, type Role } from "@/lib/nav-config";

const ACCENT_BORDER: Record<string, string> = {
  primary: "border-primary",
  secondary: "border-secondary",
  "on-secondary-fixed": "border-on-secondary-fixed",
  tertiary: "border-tertiary",
};

const ACCENT_TEXT: Record<string, string> = {
  primary: "text-primary-fixed",
  secondary: "text-secondary-fixed",
  "on-secondary-fixed": "text-secondary-fixed",
  tertiary: "text-tertiary-fixed",
};

export interface SidebarProps {
  role: Role;
  /** Called after a nav link is clicked — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

/**
 * Nav content shared by the desktop-fixed sidebar slot and the mobile
 * drawer (AppShell renders this component in both places instead of two
 * separate hand-rolled nav lists).
 */
export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const config = ROLE_CONFIG[role];

  return (
    <div className="flex h-full flex-col bg-inverse-surface py-lg">
      <div className="mb-md px-lg">
        <h1 className="text-headline-sm font-bold text-primary-fixed">Dr. Grace Gavino</h1>
        <p className="text-label-sm uppercase tracking-widest text-surface-variant/70">
          {config.subtitle}
        </p>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-md overflow-y-auto px-sm">
        {config.navGroups.map((group, i) => (
          <div key={group.label ?? i} className="space-y-xs">
            {group.label && (
              <p className="px-md pt-sm text-label-sm uppercase tracking-widest text-outline-variant">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-md rounded-lg px-md py-sm text-label-md transition-all",
                    active
                      ? cn("border-l-4 bg-on-secondary-fixed-variant", ACCENT_BORDER[config.accent], ACCENT_TEXT[config.accent])
                      : "text-outline-variant hover:bg-on-secondary-fixed-variant/50 hover:text-inverse-on-surface",
                  )}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-base border-t border-outline/20 px-sm pt-md">
        <Link
          href="/logout"
          className="flex items-center gap-md rounded-lg px-md py-sm text-label-md text-outline-variant transition-all hover:bg-on-secondary-fixed-variant/50 hover:text-inverse-on-surface"
        >
          <Icon name="logout" />
          Logout
        </Link>
      </div>
    </div>
  );
}
