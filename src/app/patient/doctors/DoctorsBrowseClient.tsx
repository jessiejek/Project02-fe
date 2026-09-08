"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
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
      <Card className="flex flex-col gap-md sm:flex-row">
        <select
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          className="rounded-lg border border-outline-variant px-md py-sm text-body-md"
        >
          <option value="all">All Specializations</option>
          {specializations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "alpha" | "soonest")}
          className="rounded-lg border border-outline-variant px-md py-sm text-body-md"
        >
          <option value="alpha">Alphabetical</option>
          <option value="soonest">Soonest Available</option>
        </select>
      </Card>

      {visible.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No doctors match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((doc) => (
            <Card key={doc.id}>
              <div className="mb-md flex items-center gap-md">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
                  <Icon name="person" className="text-[28px] text-on-surface-variant" />
                </div>
                <div>
                  <h3 className="text-headline-sm text-on-surface">{doc.name}</h3>
                  <p className="text-label-md text-on-surface-variant">{doc.specialization}</p>
                </div>
              </div>
              <div className="mb-md flex items-center justify-between">
                <div className="flex items-center gap-xs">
                  <Icon name="star" className="text-sm text-tertiary" />
                  <span className="text-label-sm font-bold">{doc.rating}</span>
                  <span className="text-label-sm text-on-surface-variant">({doc.reviewCount})</span>
                </div>
                <StatusPill status={doc.dayStatus} />
              </div>
              <Link href={`/patient/doctors/${doc.id}`}>
                <Button variant="secondary" className="w-full">
                  View Profile
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
