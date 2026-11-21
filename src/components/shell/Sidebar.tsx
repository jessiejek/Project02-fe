"use client";

//JJQR Nov 20, 2026
import { useEffect } from "react";
import { isLogoutPending, markLogoutPending } from "@/lib/auth/logout-intent";
//JJQR - END
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { ROLE_CONFIG, type Role } from "@/lib/nav-config";
//JJQR - AI (Nov 14, 2026)
import { clearClientCaches } from "@/lib/pwa/clearClientCaches";
//JJQR - END

const ACCENT_BACKGROUND: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  "on-secondary-fixed": "bg-on-secondary-fixed",
  tertiary: "bg-tertiary",
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
  //JJQR Nov 20, 2026 - Logout was clicked but this page loaded anyway (dev Fast Refresh full reload
  // cancelled the /logout navigation): finish the logout without a second click.
  useEffect(() => {
    if (isLogoutPending(window.sessionStorage)) window.location.replace("/logout");
  }, []);
  //JJQR - END
  const config = ROLE_CONFIG[role];

  return (
    <div className={cn("flex h-full flex-col py-lg", "bg-inverse-surface")}>
      <div className={cn("mb-md flex items-center gap-sm", collapsed ? "justify-center px-xs" : "px-lg")}>
        {!collapsed && (
          <div className="min-w-0">
            <p className={cn("truncate text-headline-sm font-semibold", "text-white")}>Dr. Grace Gavino</p>
            <p className={cn("text-label-sm", "truncate uppercase tracking-widest text-white/60")}>
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
              "shrink-0 rounded-full p-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white",
              !collapsed && "ml-auto",
            )}
          >
            <Icon name={collapsed ? "chevron_right" : "chevron_left"} />
          </button>
        )}
      </div>

      <nav aria-label={role === "doctor" ? "Doctor workspace" : config.subtitle} className={cn("custom-scrollbar flex-1 space-y-lg overflow-y-auto", collapsed ? "px-xs" : "px-sm")}>
        {config.navGroups.map((group, i) => (
          <div key={group.label ?? i} className="space-y-xs">
            {group.label && !collapsed && (
              <p className={cn("px-md pt-sm text-label-sm font-medium", "uppercase tracking-widest text-white/50")}>
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || (role === "doctor" && (pathname.startsWith(item.href + "/") || (item.href === "/doctor/appointments" && pathname.startsWith("/doctor/consultation"))));
              return (
                <Link
                  //JJQR - AI (Oct 31, 2026) — unique key when two items share href (Templates+Settings)
                  key={`${item.label}:${item.href}`}
                  //JJQR - END
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group/sidebar-nav relative flex min-h-11 items-center gap-md rounded-nav py-sm text-label-md transition-colors motion-reduce:transition-none",
                    collapsed ? "justify-center px-sm" : "px-md",
                    active
                      ? "bg-white/10 font-semibold text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {/* A separate inset indicator stays straight instead of following the link's corners. */}
                  <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-sm left-0 w-[3px] rounded-none", ACCENT_BACKGROUND[config.accent], active ? "opacity-100" : "opacity-0 group-hover/sidebar-nav:opacity-100")} />
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={cn("space-y-base border-t border-white/10 pt-md", collapsed ? "px-xs" : "px-sm")}>
        {/* Plain <a>, not <Link>: /logout is a destructive GET (it revokes the
            refresh token + clears cookies). Next would prefetch a <Link> on
            viewport/hover and silently log the user out. */}
        <a
          href="/logout"
          //JJQR - AI (Nov 14, 2026)
          onClick={async (event) => {
            event.preventDefault();
            //JJQR Nov 20, 2026 - remember the click so a reload that cancels /logout resumes it
            markLogoutPending(window.sessionStorage);
            //JJQR - END
            await Promise.race([
              clearClientCaches(),
              new Promise<void>((resolve) => {
                window.setTimeout(resolve, 1500);
              }),
            ]);
            window.location.assign("/logout");
          }}
          //JJQR - END
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-md rounded-nav py-sm text-label-md text-white/75 transition-colors hover:bg-white/10 hover:text-white",
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
