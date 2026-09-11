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
  /** Icon-only mode (desktop only — the mobile drawer never collapses). */
  collapsed?: boolean;
  /** Desktop collapse toggle — omitted in the mobile drawer, which has no use for it. */
  onToggleCollapsed?: () => void;
}

/**
 * Nav content shared by the desktop-fixed sidebar slot and the mobile
 * drawer (AppShell renders this component in both places instead of two
 * separate hand-rolled nav lists).
 */
export function Sidebar({ role, onNavigate, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const config = ROLE_CONFIG[role];

  return (
    <div className="flex h-full flex-col bg-inverse-surface py-lg">
      <div className={cn("mb-md flex items-center gap-sm", collapsed ? "justify-center px-xs" : "px-lg")}>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-headline-sm font-bold text-primary-fixed">Dr. Grace Gavino</h1>
            <p className="truncate text-label-sm uppercase tracking-widest text-surface-variant/70">
              {config.subtitle}
            </p>
          </div>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "shrink-0 rounded-full p-xs text-outline-variant transition-colors hover:bg-on-secondary-fixed-variant/50 hover:text-inverse-on-surface",
              !collapsed && "ml-auto",
            )}
          >
            <Icon name={collapsed ? "chevron_right" : "chevron_left"} />
          </button>
        )}
      </div>

      <nav className={cn("custom-scrollbar flex-1 space-y-md overflow-y-auto", collapsed ? "px-xs" : "px-sm")}>
        {config.navGroups.map((group, i) => (
          <div key={group.label ?? i} className="space-y-xs">
            {group.label && !collapsed && (
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
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-md rounded-lg py-sm text-label-md transition-all",
                    collapsed ? "justify-center px-sm" : "px-md",
                    active
                      ? cn("border-l-4 bg-on-secondary-fixed-variant", ACCENT_BORDER[config.accent], ACCENT_TEXT[config.accent])
                      : "text-outline-variant hover:bg-on-secondary-fixed-variant/50 hover:text-inverse-on-surface",
                  )}
                >
                  <Icon name={item.icon} />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={cn("space-y-base border-t border-outline/20 pt-md", collapsed ? "px-xs" : "px-sm")}>
        {/* Plain <a>, not <Link>: /logout is a destructive GET (it revokes the
            refresh token + clears cookies). Next would prefetch a <Link> on
            viewport/hover and silently log the user out. */}
        <a
          href="/logout"
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-md rounded-lg py-sm text-label-md text-outline-variant transition-all hover:bg-on-secondary-fixed-variant/50 hover:text-inverse-on-surface",
            collapsed ? "justify-center px-sm" : "px-md",
          )}
        >
          <Icon name="logout" />
          {!collapsed && "Logout"}
        </a>
      </div>
    </div>
  );
}
