"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
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
  { id: "hours", label: "Hours" },
  { id: "fees", label: "Fees" },
  { id: "payments", label: "Payments" },
  { id: "privacy", label: "Privacy & consent" },
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
  feeConsultation: 450,
  feeFollowUp: 350,
  feeSeniorPwd: 400,
  feeMedCert: 50,
  discountPct: 0.2,
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
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      let settingsRes, hoursRes, methodsRes;
      try {
        [settingsRes, hoursRes, methodsRes] = await Promise.all([
          queryClinicSettings(supabase).then((data) => ({ data })),
          queryOperatingHours(supabase).then((data) => ({ data })),
          queryPaymentMethods(supabase).then((rows) => ({ data: rows.map((m) => ({ payment_method: m })) })),
        ]);
      } catch {
        setLoadError(true);
        return;
      }
      setLoadError(false);
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
          feeConsultation: s.fee_consultation ?? 450,
          feeFollowUp: s.fee_follow_up ?? 350,
          feeSeniorPwd: s.fee_senior_pwd ?? 400,
          feeMedCert: s.fee_med_cert ?? 50,
          discountPct: s.discount_pct ?? 0.2,
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
  }, [reloadKey]);

  /** One pending/error/saved path for every tab's Save button. */
  async function run(action: () => Promise<void>, failure: string) {
    setSaving(true);
    setSaveError("");
    try {
      await action();
    } catch {
      setSaveError(failure);
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    const supabase = null as never;
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

  async function saveFees() {
    const supabase = null as never;
    await updateClinicSettings(supabase, {
      fee_consultation: settings.feeConsultation,
      fee_follow_up: settings.feeFollowUp,
      fee_senior_pwd: settings.feeSeniorPwd,
      fee_med_cert: settings.feeMedCert,
      discount_pct: settings.discountPct,
    });
    setSavedAt(new Date().toLocaleTimeString());
  }

  async function saveHours() {
    const supabase = null as never;
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

  const invalidHour = hours.find((h) => !h.isClosed && h.openTime && h.closeTime && !(h.closeTime > h.openTime));
  const DAY_LABEL: Record<string, string> = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
  const field = (id: string, label: string, control: React.ReactNode, hint?: string) => (
    <div className="space-y-xs">
      <label htmlFor={id} className={labelStyles}>{label}</label>
      {control}
      {hint && <p className={hintStyles}>{hint}</p>}
    </div>
  );
  const saveBar = (onSave: () => void, label = "Save changes", disabled = false) => (
    <div className="flex flex-wrap items-center justify-end gap-md border-t border-outline-variant pt-md">
      <Button onClick={onSave} loading={saving} disabled={disabled}>{saving ? "Saving…" : label}</Button>
    </div>
  );

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-doctor-record space-y-lg">
        <PageHeader title="Clinic settings" description="Details patients see on the public page, opening hours, fees and payment options." />
        {savedAt && <Toast key={savedAt} variant="success" message={`Settings saved at ${savedAt}.`} />}

        {loadError ? (
          <ErrorState title="Settings unavailable" message="Clinic settings could not be loaded. Nothing has been changed; try again." onRetry={() => { setLoadError(false); setReloadKey((k) => k + 1); }} />
        ) : !loaded ? (
          <div aria-busy="true"><p className="sr-only" role="status">Loading settings…</p><SkeletonCard lines={6} /></div>
        ) : (
      <Card>
        <Tabs tabs={TABS} activeId={tab} onChange={(id) => { setTab(id); setSaveError(""); }} className="mb-lg" />
        {saveError && <FormAlert className="mb-md">{saveError}</FormAlert>}

        {tab === "general" && (
          <div className="space-y-md">
            {field("set-name", "Clinic name", <input id="set-name" required value={settings.clinicName} onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })} className={inputStyles()} />)}
            {field("set-address", "Address", <input id="set-address" required value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className={inputStyles()} />, "Shown on the public home page under “Find us”.")}
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              {field("set-contact", "Contact number", <input id="set-contact" type="tel" value={settings.contactNumber ?? ""} onChange={(e) => setSettings({ ...settings, contactNumber: e.target.value })} className={inputStyles()} />)}
              {field("set-email", "Email", <input id="set-email" type="email" value={settings.email ?? ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className={inputStyles()} />)}
            </div>
            {field("set-desc", "Description", <textarea id="set-desc" value={settings.description ?? ""} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={3} className={inputStyles("py-md")} />)}
            {saveBar(() => run(async () => { await saveSettings(); }, "Clinic details could not be saved. Your changes are still here; try again."))}
          </div>
        )}

        {tab === "hours" && (
          <div className="space-y-md">
            <div className="divide-y divide-outline-variant">
              {hours.map((h, i) => (
                <div key={h.day} className="flex flex-wrap items-center justify-between gap-sm py-sm sm:gap-md">
                  <span className="w-28 shrink-0 text-body-md font-medium text-on-surface">{DAY_LABEL[h.day] ?? h.day}</span>
                  {h.isClosed ? (
                    <span className="flex-1 text-body-md text-on-surface-variant">Closed</span>
                  ) : (
                    <div className="flex flex-1 items-center gap-sm">
                      <input type="time" aria-label={`${DAY_LABEL[h.day] ?? h.day} opens`} value={h.openTime} onChange={(e) => updateHour(i, { openTime: e.target.value })} className={inputStyles("w-[8.5rem] tabular-nums")} />
                      <span aria-hidden="true" className="text-on-surface-variant">–</span>
                      <input type="time" aria-label={`${DAY_LABEL[h.day] ?? h.day} closes`} value={h.closeTime} onChange={(e) => updateHour(i, { closeTime: e.target.value })} className={inputStyles("w-[8.5rem] tabular-nums")} />
                    </div>
                  )}
                  <label className="flex min-h-11 items-center gap-sm text-label-md text-on-surface">
                    <input type="checkbox" checked={h.isClosed} onChange={(e) => updateHour(i, { isClosed: e.target.checked })} className="h-5 w-5 accent-primary" />
                    Closed
                  </label>
                </div>
              ))}
            </div>
            {invalidHour && <FormAlert tone="warning">{DAY_LABEL[invalidHour.day] ?? invalidHour.day}: closing time must be after opening time.</FormAlert>}
            {saveBar(() => run(saveHours, "Opening hours could not be saved. Try again."), "Save hours", Boolean(invalidHour))}
          </div>
        )}

        {tab === "fees" && (
          <div className="space-y-md">
            <p className={hintStyles}>
              Flat clinic-wide fee schedule (contract §16.6). The doctor picks which
              line applies during the consultation; the booking total is recomputed
              on save.
            </p>
            <div className="divide-y divide-outline-variant">
            {(
              [
                ["feeConsultation", "Standard consultation"],
                ["feeFollowUp", "Follow-up consultation"],
                ["feeSeniorPwd", "Senior citizen / PWD"],
                ["feeMedCert", "Medical certificate (add-on)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-md py-sm">
                <span className="text-body-md text-on-surface">{label}</span>
                <span className="flex items-center gap-xs">
                  <span aria-hidden="true" className="text-on-surface-variant">₱</span>
                  <input type="number" min={0} step={10} value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                    className={inputStyles("w-28 text-right tabular-nums")} />
                </span>
              </label>
            ))}
            <label className="flex items-center justify-between gap-md py-sm">
              <span>
                <span className="block text-body-md text-on-surface">Senior / PWD discount</span>
                <span className={hintStyles}>Parked: stored with the fee schedule.</span>
              </span>
              <span className="flex items-center gap-xs">
                <input type="number" min={0} max={100} step={1} value={Math.round(settings.discountPct * 100)}
                  onChange={(e) => setSettings({ ...settings, discountPct: Number(e.target.value) / 100 })}
                  className={inputStyles("w-28 text-right tabular-nums")} />
                <span aria-hidden="true" className="text-on-surface-variant">%</span>
              </span>
            </label>
            </div>
            {saveBar(() => run(saveFees, "Fees could not be saved. Try again."), "Save fees")}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-md">
            {field("set-mode", "Default payment mode", (
              <select id="set-mode" value={settings.defaultPaymentMode}
                onChange={(e) => setSettings({ ...settings, defaultPaymentMode: e.target.value as typeof settings.defaultPaymentMode })} className={inputStyles()}>
                <option value="PayAtClinic">Pay at clinic</option>
                <option value="Online">Online</option>
              </select>
            ))}
            <fieldset className="min-w-0 space-y-xs">
              <legend className={labelStyles}>Accepted at the front desk</legend>
              <div className="grid grid-cols-2 gap-x-md sm:grid-cols-4">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m} className="flex min-h-11 items-center gap-sm text-body-md text-on-surface">
                    <input type="checkbox" checked={settings.acceptedPaymentMethods.includes(m)} onChange={() => toggleMethod(m)} className="h-5 w-5 accent-primary" />
                    {m === "BankTransfer" ? "Bank transfer" : m}
                  </label>
                ))}
              </div>
            </fieldset>
            {field("set-refund", "Refund policy", <textarea id="set-refund" value={settings.refundPolicy ?? ""} onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })} rows={3} className={inputStyles("py-md")} />)}
            {saveBar(() => run(saveSettings, "Payment settings could not be saved. Try again."))}
          </div>
        )}

        {tab === "privacy" && (
          <div className="space-y-lg">
            <div className="space-y-md">
              {field("set-privacy", "Privacy policy", <textarea id="set-privacy" value={settings.privacyPolicyText ?? ""} onChange={(e) => setSettings({ ...settings, privacyPolicyText: e.target.value })} rows={6} className={inputStyles("py-md")} />, "Patients read this on the Privacy & consent page.")}
              {saveBar(() => run(saveSettings, "The privacy policy could not be saved. Try again."), "Save policy")}
            </div>
            <section aria-labelledby="consent-h" className="space-y-md rounded-lg border border-outline-variant p-md">
              <div className="flex flex-wrap items-baseline justify-between gap-sm">
                <h2 id="consent-h" className="text-headline-sm text-on-surface">Consent version</h2>
                <span className="text-headline-md tabular-nums text-on-surface">v{settings.consentVersion}</span>
              </div>
              <p className={hintStyles}>Publish a new version after a material policy change so every patient is asked to consent again.</p>
              {bumpConfirmOpen && (
                <FormAlert tone="warning">This will re-trigger the consent banner for every patient.</FormAlert>
              )}
              <div className="flex flex-wrap gap-sm">
                <Button
                  variant={bumpConfirmOpen ? "primary" : "secondary"}
                  loading={saving && bumpConfirmOpen}
                  onClick={async () => {
                    if (!bumpConfirmOpen) {
                      setBumpConfirmOpen(true);
                      return;
                    }
                    const nextVersion = settings.consentVersion + 1;
                    const supabase = null as never;
                    await run(async () => {
                      await updateClinicSettings(supabase, { consent_version: nextVersion });
                      setSettings((prev) => ({ ...prev, consentVersion: nextVersion }));
                      setBumpConfirmOpen(false);
                    }, "The consent version could not be updated. Try again.");
                  }}
                >
                  {bumpConfirmOpen ? `Yes, publish v${settings.consentVersion + 1}` : "Publish new consent version"}
                </Button>
                {bumpConfirmOpen && <Button variant="ghost" disabled={saving} onClick={() => setBumpConfirmOpen(false)}>Cancel</Button>}
              </div>
            </section>
          </div>
        )}

        {tab === "branding" && (
          <div className="space-y-md">
            <FormAlert tone="info">
              Logo/Favicon uploads are preview-only for now — real storage + persistence lands in a later phase.
            </FormAlert>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <div className="space-y-xs">
                <span className={labelStyles}>Logo</span>
                <div className="flex items-center gap-md">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) setSettings({ ...settings, logoUrl: URL.createObjectURL(file) }); }} />
                  <Button variant="secondary" onClick={() => logoInputRef.current?.click()}>Choose logo</Button>
                  {settings.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable remote asset
                    <img src={settings.logoUrl} alt="Clinic logo preview" className="h-12 w-12 rounded-md border border-outline-variant object-cover" />
                  )}
                </div>
              </div>
              <div className="space-y-xs">
                <span className={labelStyles}>Favicon</span>
                <div className="flex items-center gap-md">
                  <input ref={faviconInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) setSettings({ ...settings, faviconUrl: URL.createObjectURL(file) }); }} />
                  <Button variant="secondary" onClick={() => faviconInputRef.current?.click()}>Choose favicon</Button>
                  {settings.faviconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable remote asset
                    <img src={settings.faviconUrl} alt="Favicon preview" className="h-8 w-8 rounded-sm border border-outline-variant object-cover" />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              {(["primaryColor", "secondaryColor"] as const).map((key) => (
                <div key={key} className="space-y-xs">
                  <label htmlFor={`set-${key}`} className={labelStyles}>{key === "primaryColor" ? "Primary colour" : "Secondary colour"}</label>
                  <div className="flex items-center gap-sm">
                    <input type="color" aria-label={`${key === "primaryColor" ? "Primary" : "Secondary"} colour picker`} value={settings[key] ?? "#000000"}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="h-11 w-11 shrink-0 rounded-md border border-outline-variant" />
                    <input id={`set-${key}`} value={settings[key] ?? ""} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} placeholder="#00685F" className={inputStyles("font-mono")} />
                  </div>
                </div>
              ))}
            </div>
            {field("set-web", "Website URL", <input id="set-web" type="url" value={settings.websiteUrl ?? ""} onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })} className={inputStyles()} />)}
            {saveBar(() => run(saveSettings, "Branding could not be saved. Try again."))}
          </div>
        )}
      </Card>
        )}
      </div>
    </AppShell>
  );
}
