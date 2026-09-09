"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  queryClinicSettings,
  updateClinicSettings,
  queryOperatingHours,
  setOperatingHours,
  queryPaymentMethods,
  setPaymentMethods,
} from "@/lib/data/admin";
import { DAYS, dayNameToIndex, indexToDayName } from "@/lib/days";
import type { ClinicSettings, OperatingHours } from "@/data/types";

const TABS = [
  { id: "general", label: "General" },
  { id: "hours", label: "Operating Hours" },
  { id: "payments", label: "Payments" },
  { id: "privacy", label: "Privacy & Consent" },
  { id: "branding", label: "Branding" },
];

// "Online" removed from this list — it's a payment_mode (how the whole
// booking is paid), not a payment_method (how an in-person payment was
// tendered); defaultPaymentMode's own "Online" option covers that concept.
const PAYMENT_METHODS = ["Cash", "GCash", "Maya", "BankTransfer"];

const EMPTY_SETTINGS: ClinicSettings = {
  clinicName: "",
  address: "",
  defaultPaymentMode: "PayAtClinic",
  acceptedPaymentMethods: [],
  consentVersion: 1,
};

function defaultHours(): OperatingHours[] {
  return DAYS.map((day) => ({
    day,
    isClosed: day === "Sun",
    openTime: day === "Sun" ? "" : "08:00",
    closeTime: day === "Sun" ? "" : "17:00",
  }));
}

// Stitch system_settings_admin — 5 tabs. Previously had zero wired state at
// all (every field was defaultValue-only) — found during the app-wide
// decorative-input sweep.
export default function AdminSettingsPage() {
  const [tab, setTab] = useState("general");
  const [bumpConfirmOpen, setBumpConfirmOpen] = useState(false);
  const [settings, setSettings] = useState<ClinicSettings>(EMPTY_SETTINGS);
  const [hours, setHours] = useState<OperatingHours[]>(defaultHours);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [settingsRes, hoursRes, methodsRes] = await Promise.all([
        queryClinicSettings(supabase).then((data) => ({ data })),
        queryOperatingHours(supabase).then((data) => ({ data })),
        queryPaymentMethods(supabase).then((rows) => ({ data: rows.map((m) => ({ payment_method: m })) })),
      ]);
      if (settingsRes.data) {
        const s = settingsRes.data;
        setSettings({
          clinicName: s.clinic_name,
          address: s.address,
          contactNumber: s.contact_number ?? undefined,
          email: s.email ?? undefined,
          description: s.description ?? undefined,
          defaultPaymentMode: s.default_payment_mode as "Online" | "PayAtClinic",
          acceptedPaymentMethods: (methodsRes.data ?? []).map((m) => m.payment_method),
          refundPolicy: s.refund_policy ?? undefined,
          consentVersion: s.consent_version,
          primaryColor: s.primary_color ?? undefined,
          secondaryColor: s.secondary_color ?? undefined,
          privacyPolicyText: s.privacy_policy_text ?? undefined,
          logoUrl: s.logo_url ?? undefined,
          faviconUrl: s.favicon_url ?? undefined,
          websiteUrl: s.website_url ?? undefined,
        });
      }
      if (hoursRes.data) {
        setHours(
          hoursRes.data.map((h) => ({
            day: indexToDayName(h.day_of_week),
            isClosed: h.is_closed,
            openTime: h.open_time ?? "",
            closeTime: h.close_time ?? "",
          })),
        );
      }
      setLoaded(true);
    }
    load();
  }, []);

  async function saveSettings() {
    const supabase = createClient();
    // logoUrl/faviconUrl deliberately excluded — Upload Logo/Favicon only
    // produce a local blob: preview today (real Storage upload is Phase 9),
    // and a blob: URL is meaningless outside this browser session, so it's
    // never written to the real row.
    await updateClinicSettings(supabase, {
      clinic_name: settings.clinicName,
      address: settings.address,
      contact_number: settings.contactNumber || null,
      email: settings.email || null,
      description: settings.description || null,
      default_payment_mode: settings.defaultPaymentMode,
      refund_policy: settings.refundPolicy || null,
      primary_color: settings.primaryColor || null,
      secondary_color: settings.secondaryColor || null,
      website_url: settings.websiteUrl || null,
      privacy_policy_text: settings.privacyPolicyText || null,
    });

    await setPaymentMethods(supabase, settings.acceptedPaymentMethods);

    setSavedAt(new Date().toLocaleTimeString());
  }

  async function saveHours() {
    const supabase = createClient();
    await setOperatingHours(
      supabase,
      hours.map((h) => ({
        day_of_week: dayNameToIndex(h.day),
        is_closed: h.isClosed,
        open_time: h.openTime || null,
        close_time: h.closeTime || null,
      })),
    );
    setSavedAt(new Date().toLocaleTimeString());
  }

  function toggleMethod(method: string) {
    setSettings((prev) => ({
      ...prev,
      acceptedPaymentMethods: prev.acceptedPaymentMethods.includes(method)
        ? prev.acceptedPaymentMethods.filter((m) => m !== method)
        : [...prev.acceptedPaymentMethods, method],
    }));
  }

  function updateHour(index: number, patch: Partial<(typeof hours)[number]>) {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  return (
    <AppShell role="admin">
      <Card className="mx-auto max-w-[44rem]">
        {savedAt && <Toast key={savedAt} variant="success" message={`Settings saved at ${savedAt}.`} />}
        <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-lg" />

        {!loaded && <p className="text-body-md text-on-surface-variant">Loading settings…</p>}

        {loaded && tab === "general" && (
          <div className="space-y-md">
            <input
              placeholder="Clinic Name*"
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              placeholder="Address*"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              placeholder="Contact"
              value={settings.contactNumber ?? ""}
              onChange={(e) => setSettings({ ...settings, contactNumber: e.target.value })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              placeholder="Email"
              value={settings.email ?? ""}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <textarea
              placeholder="Description"
              value={settings.description ?? ""}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-outline-variant p-md"
            />
            <Button onClick={saveSettings}>Save</Button>
          </div>
        )}

        {loaded && tab === "hours" && (
          <div className="space-y-sm">
            {hours.map((h, i) => (
              <div key={h.day} className="flex flex-wrap items-center gap-sm sm:gap-md">
                <span className="w-16 shrink-0 text-body-md">{h.day}</span>
                <input
                  type="time"
                  value={h.openTime}
                  disabled={h.isClosed}
                  onChange={(e) => updateHour(i, { openTime: e.target.value })}
                  className="rounded-lg border border-outline-variant px-md py-xs disabled:opacity-50"
                />
                <span>–</span>
                <input
                  type="time"
                  value={h.closeTime}
                  disabled={h.isClosed}
                  onChange={(e) => updateHour(i, { closeTime: e.target.value })}
                  className="rounded-lg border border-outline-variant px-md py-xs disabled:opacity-50"
                />
                <label className="flex items-center gap-sm text-label-md text-on-surface-variant sm:ml-auto">
                  <input
                    type="checkbox"
                    checked={h.isClosed}
                    onChange={(e) => updateHour(i, { isClosed: e.target.checked })}
                    className="h-5 w-5"
                  />
                  Closed
                </label>
              </div>
            ))}
            <Button className="mt-md" onClick={saveHours}>Save</Button>
          </div>
        )}

        {loaded && tab === "payments" && (
          <div className="space-y-md">
            <select
              value={settings.defaultPaymentMode}
              onChange={(e) => setSettings({ ...settings, defaultPaymentMode: e.target.value as typeof settings.defaultPaymentMode })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            >
              <option value="PayAtClinic">Pay at Clinic</option>
              <option value="Online">Online</option>
            </select>
            <div className="space-y-sm">
              {PAYMENT_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-sm text-body-md">
                  <input
                    type="checkbox"
                    checked={settings.acceptedPaymentMethods.includes(m)}
                    onChange={() => toggleMethod(m)}
                    className="h-5 w-5"
                  />
                  {m}
                </label>
              ))}
            </div>
            <textarea
              placeholder="Refund Policy"
              value={settings.refundPolicy ?? ""}
              onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-outline-variant p-md"
            />
            <Button onClick={saveSettings}>Save</Button>
          </div>
        )}

        {loaded && tab === "privacy" && (
          <div className="space-y-md">
            <textarea
              placeholder="Privacy Policy Text"
              value={settings.privacyPolicyText ?? ""}
              onChange={(e) => setSettings({ ...settings, privacyPolicyText: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-outline-variant p-md"
            />
            <Button onClick={saveSettings}>Save</Button>
            <p className="text-label-md text-on-surface-variant">Current Consent Version: {settings.consentVersion}</p>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!bumpConfirmOpen) {
                  setBumpConfirmOpen(true);
                  return;
                }
                const nextVersion = settings.consentVersion + 1;
                const supabase = createClient();
                await updateClinicSettings(supabase, { consent_version: nextVersion });
                setSettings((prev) => ({ ...prev, consentVersion: nextVersion }));
                setBumpConfirmOpen(false);
              }}
            >
              Bump Consent Version
            </Button>
            {bumpConfirmOpen && (
              <p className="rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
                This will re-trigger the consent banner for every patient.
              </p>
            )}
          </div>
        )}

        {loaded && tab === "branding" && (
          <div className="space-y-md">
            <p className="text-label-sm text-on-surface-variant">
              Logo/Favicon uploads are preview-only for now — real storage + persistence lands in a later phase.
            </p>
            <div className="flex items-center gap-md">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSettings({ ...settings, logoUrl: URL.createObjectURL(file) });
                }}
              />
              <Button variant="secondary" onClick={() => logoInputRef.current?.click()}>Upload Logo</Button>
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable remote asset
                <img src={settings.logoUrl} alt="Clinic logo preview" className="h-12 w-12 rounded border border-outline-variant object-cover" />
              )}
            </div>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <div className="flex items-center gap-sm">
                <input
                  type="color"
                  value={settings.primaryColor ?? "#000000"}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="h-10 w-10 rounded border border-outline-variant"
                />
                <input
                  value={settings.primaryColor ?? ""}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="flex-1 rounded-lg border border-outline-variant px-md py-sm"
                />
              </div>
              <div className="flex items-center gap-sm">
                <input
                  type="color"
                  value={settings.secondaryColor ?? "#000000"}
                  onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                  className="h-10 w-10 rounded border border-outline-variant"
                />
                <input
                  value={settings.secondaryColor ?? ""}
                  onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                  className="flex-1 rounded-lg border border-outline-variant px-md py-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-md">
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSettings({ ...settings, faviconUrl: URL.createObjectURL(file) });
                }}
              />
              <Button variant="secondary" onClick={() => faviconInputRef.current?.click()}>Upload Favicon</Button>
              {settings.faviconUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable remote asset
                <img src={settings.faviconUrl} alt="Favicon preview" className="h-8 w-8 rounded border border-outline-variant object-cover" />
              )}
            </div>
            <input
              placeholder="Website URL"
              value={settings.websiteUrl ?? ""}
              onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <Button onClick={saveSettings}>Save</Button>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
