"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { globalSearch, type GlobalSearchResult, type SearchBookingHit, type SearchDoctorHit, type SearchPatientHit } from "@/lib/data/search";

export interface TopbarProps {
  onMenuClick: () => void;
  /** Doctor's Available/RunningLate/Unavailable badge, or Admin's role badge. */
  roleBadge?: ReactNode;
}

type FlatHit =
  | { kind: "patient"; item: SearchPatientHit }
  | { kind: "doctor"; item: SearchDoctorHit }
  | { kind: "booking"; item: SearchBookingHit };

function flattenResults(data: GlobalSearchResult): FlatHit[] {
  return [
    ...data.patients.map((item) => ({ kind: "patient" as const, item })),
    ...data.doctors.map((item) => ({ kind: "doctor" as const, item })),
    ...data.bookings.map((item) => ({ kind: "booking" as const, item })),
  ];
}

function hitLabel(hit: FlatHit): string {
  if (hit.kind === "patient") return `${hit.item.first_name} ${hit.item.last_name} · ${hit.item.patient_code}`;
  if (hit.kind === "doctor") return `${hit.item.full_name} · ${hit.item.specialization}`;
  return `${hit.item.patient_name} · ${hit.item.appointment_date} · ${hit.item.status}`;
}

function hitHref(role: string | undefined, hit: FlatHit): string | null {
  if (hit.kind === "patient") {
    if (role === "Doctor") return `/doctor/patients/${hit.item.id}`;
    if (role === "Admin") return `/admin/patients/${hit.item.id}`;
    if (role === "Staff") return `/staff/patients/${hit.item.id}`;
    return null;
  }
  if (hit.kind === "doctor") {
    if (role === "Admin") return `/admin/doctors/${hit.item.doctor_id}`;
    if (role === "Staff") return `/staff/doctors/${hit.item.doctor_id}`;
    return null;
  }
  if (hit.kind === "booking") {
    if (role === "Patient") return `/patient/bookings/${hit.item.booking_id}`;
    if (role === "Doctor") return `/doctor/appointments/${hit.item.booking_id}`;
    if (role === "Admin") return `/admin/bookings/${hit.item.booking_id}`;
    if (role === "Staff") return `/staff/bookings/${hit.item.booking_id}`;
  }
  return null;
}

/**
 * Shared topbar for all four roles. The hamburger button here is the fix for
 * the decorative, non-functional icon found in ~28 of the 61 exported
 * screens (Responsive-Analysis.md §2) — it actually opens the mobile drawer.
 */
export function Topbar({ onMenuClick, roleBadge }: TopbarProps) {
  const router = useRouter();
  const { session } = useSession();
  const role = session?.role;

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FlatHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Query string for which `results` / empty state reflect a finished fetch. */
  const [settledQuery, setSettledQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const initials = session?.displayName
    ? session.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const navigateHit = useCallback(
    (hit: FlatHit) => {
      const href = hitHref(role, hit);
      if (!href) return;
      setOpen(false);
      setSearch("");
      setResults([]);
      router.push(href);
    },
    [role, router],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 2) {
      debounceRef.current = setTimeout(() => {
        setResults([]);
        setOpen(false);
        setLoading(false);
        setSettledQuery("");
      }, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      globalSearch(q)
        .then((data) => {
          const flat = flattenResults(data);
          setResults(flat);
          setActiveIndex(flat.length > 0 ? 0 : -1);
          setSettledQuery(q);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setSettledQuery(q);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-lg shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-md">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="shrink-0 rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high lg:hidden"
        >
          <Icon name="menu" />
        </button>
        {/*JJQR - AI (Oct 31, 2026)*/}
        <div ref={rootRef} className="relative hidden min-w-0 max-w-72 flex-1 sm:block">
          <Icon name="search" className="absolute left-sm top-1/2 z-10 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="topbar-search-listbox"
            aria-autocomplete="list"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => { if (results.length > 0 || search.trim().length >= 2) setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
              if (!open || results.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % results.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
              } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                navigateHit(results[activeIndex]!);
              }
            }}
            placeholder="Search patients, doctors, or appointments..."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-xs pl-xl pr-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search.trim().length >= 2 && !loading && settledQuery === search.trim() && open && (
            <ul
              id="topbar-search-listbox"
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-xs max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface py-xs shadow-lg"
            >
              {results.length === 0 && (
                <li role="option" aria-selected={false} className="px-md py-sm text-body-sm text-on-surface-variant">
                  No results
                </li>
              )}
              {results.map((hit, i) => {
                const href = hitHref(role, hit);
                return (
                  <li
                    key={`${hit.kind}-${hit.kind === "patient" ? hit.item.id : hit.kind === "doctor" ? hit.item.doctor_id : hit.item.booking_id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                  >
                    <button
                      type="button"
                      disabled={!href}
                      className={`flex w-full px-md py-sm text-left text-body-sm ${i === activeIndex ? "bg-surface-container-high" : "hover:bg-surface-container-low"} disabled:opacity-50`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => navigateHit(hit)}
                    >
                      <span className="mr-sm text-label-sm uppercase text-on-surface-variant">{hit.kind}</span>
                      {hitLabel(hit)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {/*JJQR - END*/}
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
