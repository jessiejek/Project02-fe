"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatClinicDateTime } from "@/lib/format";
import { queryAnnouncements } from "@/lib/data/admin";
import { queryStaffAccounts } from "@/lib/data/staff";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  postedDate: string;
  postedBy: string;
}

// Stitch announcements_staff — view-only per Staff.md §9 / admin.md's
// confirmed Admin-only write authorization. Reads real `announcements`.
export default function StaffAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
      const supabase = null as never;
      let announcementsRes;
      try {
        announcementsRes = { data: await queryAnnouncements(supabase, { activeOnly: true }) };
        setLoadError(false);
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }
      // Poster names are a nice-to-have; fall back to "Clinic admin" if the staff list is unavailable.
      const staffRes = await queryStaffAccounts(supabase).then((data) => ({ data })).catch(() => ({ data: [] as Awaited<ReturnType<typeof queryStaffAccounts>> }));

      const nameByUserId = new Map((staffRes.data ?? []).map((s) => [s.user_id, s.full_name]));
      setAnnouncements(
        (announcementsRes.data ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          postedDate: a.created_at,
          postedBy: (a.posted_by_user_id && nameByUserId.get(a.posted_by_user_id)) || "Clinic admin",
        })),
      );
      setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <PageHeader
          title="Clinic announcements"
          description="What patients currently see on their portal. Only admins can post or edit these."
        />
        {loading ? (
          <div className="space-y-md" aria-busy="true">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : loadError ? (
          <ErrorState
            title="Announcements didn’t load"
            message="Check the connection to the clinic server, then try again."
            retrying={retrying}
            onRetry={async () => { setRetrying(true); await load(); setRetrying(false); }}
          />
        ) : announcements.length === 0 ? (
          <EmptyState icon="campaign" message="No announcements are showing right now." />
        ) : (
          <ul className="space-y-md">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card className="space-y-sm">
                  <h2 className="text-balance text-headline-sm text-on-surface">{a.title}</h2>
                  <p className="whitespace-pre-line text-body-md text-on-surface">{a.body}</p>
                  <p className="text-label-md text-on-surface-variant">
                    <span className="tabular-nums">{formatClinicDateTime(a.postedDate)}</span> · {a.postedBy}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
