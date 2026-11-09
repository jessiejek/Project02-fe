"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { Icon } from "@/components/ui/Icon";

export interface BrowseDoctorCard {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  reviewCount: number;
  dayStatus: string;
}

export function DoctorsBrowseClient({
  doctors,
  specializations,
}: {
  doctors: BrowseDoctorCard[];
  specializations: string[];
}) {
  const [specialization, setSpecialization] = useState("all");
  const [sortBy, setSortBy] = useState<"alpha" | "soonest">("alpha");

  const visible = useMemo(() => {
    let rows = doctors;
    if (specialization !== "all") {
      rows = rows.filter((d) => d.specialization === specialization);
    }
    const sorted = [...rows];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Soonest available: Available first, then RunningLate, then UnavailableToday, then name.
      const rank: Record<string, number> = { Available: 0, RunningLate: 1, UnavailableToday: 2 };
      sorted.sort((a, b) => {
        const rankDiff = (rank[a.dayStatus] ?? 9) - (rank[b.dayStatus] ?? 9);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [doctors, specialization, sortBy]);

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap gap-md">
        <div className="w-full space-y-xs sm:w-64">
          <label htmlFor="specialty" className={labelStyles}>Specialty</label>
          <select id="specialty" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputStyles()}>
            <option value="all">All specialties</option>
            {specializations.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-xs sm:w-64">
          <label htmlFor="sortBy" className={labelStyles}>Sort by</label>
          <select id="sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value as "alpha" | "soonest")} className={inputStyles()}>
            <option value="alpha">Name</option>
            <option value="soonest">Available today first</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant p-lg text-body-md text-on-surface-variant">No doctors match this specialty.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((doc) => (
            <li key={doc.id}>
              <Link href={`/patient/doctors/${doc.id}`} className="block h-full">
                <Card hoverable className="flex h-full flex-col gap-md">
                  <div className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <h2 className="break-words text-headline-sm text-on-surface">{doc.name}</h2>
                      <p className="text-label-md text-on-surface-variant">{doc.specialization}</p>
                    </div>
                    <StatusPill status={doc.dayStatus} />
                  </div>
                  <div className="mt-auto flex items-center justify-between text-label-md text-on-surface-variant">
                    {doc.reviewCount > 0 ? (
                      <span className="flex items-center gap-xs">
                        <Icon name="star" className="text-[14px] text-tertiary" />
                        <span className="font-medium tabular-nums text-on-surface">{doc.rating}</span>
                        <span className="tabular-nums">({doc.reviewCount} {doc.reviewCount === 1 ? "review" : "reviews"})</span>
                      </span>
                    ) : (
                      <span>No reviews yet</span>
                    )}
                    <span className="flex items-center gap-xs font-medium text-primary">Profile<Icon name="chevron_right" className="text-[12px]" /></span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
