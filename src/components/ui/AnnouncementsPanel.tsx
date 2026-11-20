"use client";

// JJQR - AI (Nov 20, 2026) - B-30: the admin page promises announcements show on the patient and staff dashboards; nothing loaded them there
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { queryAnnouncements, type AnnouncementRow } from "@/lib/data/admin";
import { formatClinicDate } from "@/lib/format";

/** Active clinic announcements, newest first (the API already filters inactive ones). Renders nothing when there are none or the call fails — never blocks the dashboard. */
export function AnnouncementsPanel({ max = 3 }: { max?: number }) {
  const [items, setItems] = useState<AnnouncementRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    queryAnnouncements(null, { activeOnly: true })
      .then((rows) => { if (!cancelled) setItems(rows.slice(0, max)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [max]);

  if (items.length === 0) return null;
  return (
    <section aria-label="Clinic announcements" className="space-y-sm">
      {items.map((a) => (
        <Card key={a.id} className="space-y-xs border-l-4 border-l-primary">
          <div className="flex items-start gap-sm">
            <Icon name="campaign" className="mt-0.5 text-[20px] text-primary" />
            <div className="min-w-0">
              <h2 className="text-balance text-headline-sm text-on-surface">{a.title}</h2>
              <p className="whitespace-pre-line text-body-md text-on-surface">{a.body}</p>
              <p className="text-label-md tabular-nums text-on-surface-variant">{formatClinicDate(a.created_at)}</p>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}
// JJQR - END
