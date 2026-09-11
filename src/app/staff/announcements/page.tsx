"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
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

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const [announcementsRes, staffRes] = await Promise.all([
        queryAnnouncements(supabase, { activeOnly: true }).then((data) => ({ data })),
        queryStaffAccounts(supabase).then((data) => ({ data })),
      ]);

      const nameByUserId = new Map((staffRes.data ?? []).map((s) => [s.user_id, s.full_name]));
      setAnnouncements(
        (announcementsRes.data ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          postedDate: a.created_at.slice(0, 10),
          postedBy: (a.posted_by_user_id && nameByUserId.get(a.posted_by_user_id)) || "Clinic Admin",
        })),
      );
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <AppShell role="staff">
        <div className="space-y-md">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <div>
          <h2 className="text-headline-lg text-on-surface">Announcements</h2>
          <p className="text-label-md text-on-surface-variant">
            Announcements are managed by clinic administrators.
          </p>
        </div>
        <div className="space-y-md">
          {announcements.length === 0 && (
            <p className="text-body-md text-on-surface-variant">No active announcements.</p>
          )}
          {announcements.map((a) => (
            <Card key={a.id}>
              <h3 className="text-headline-sm text-on-surface">{a.title}</h3>
              <p className="mt-xs text-body-md text-on-surface-variant">{a.body}</p>
              <p className="mt-sm text-label-sm text-on-surface-variant">
                {a.postedDate} · Posted by {a.postedBy}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
