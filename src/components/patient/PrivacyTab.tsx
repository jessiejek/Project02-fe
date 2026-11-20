"use client";

// JJQR - AI (Nov 20, 2026) - PV-12/13/14: the patient's own privacy controls — consent status + withdraw, download my data, ask for a correction or deletion.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { friendlyError } from "@/lib/api/friendly-error";
import { formatClinicDate, formatClinicDateTime } from "@/lib/format";
import {
  createDataRequest, decideConsent, downloadMyData, queryConsentHistory, queryMyConsentState, queryMyDataRequests,
  type ConsentHistoryRow, type DataRequestKind, type DataRequestRow, type MyConsentState,
} from "@/lib/data/privacy";

export function PrivacyTab({ patientId }: { patientId: string }) {
  const [state, setState] = useState<MyConsentState | null>(null);
  const [history, setHistory] = useState<ConsentHistoryRow[]>([]);
  const [requests, setRequests] = useState<DataRequestRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [kind, setKind] = useState<DataRequestKind>("Correction");
  const [details, setDetails] = useState("");

  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    let off = false;
    Promise.all([queryMyConsentState(), queryConsentHistory(patientId), queryMyDataRequests()])
      .then(([s, h, r]) => { if (!off) { setState(s); setHistory(h); setRequests(r); setLoadError(false); } })
      .catch(() => { if (!off) setLoadError(true); });
    return () => { off = true; };
  }, [patientId, tick]);

  async function withdraw() {
    setBusy("withdraw"); setMsg(null);
    try {
      await decideConsent(patientId, "Withdrawn");
      setConfirmWithdraw(false);
      setMsg({ tone: "success", text: "Your consent is withdrawn. We have recorded it." });
      load();
    } catch (e) { setMsg({ tone: "danger", text: friendlyError(e, "We couldn't withdraw your consent. Please try again.") }); }
    setBusy("");
  }

  async function download() {
    setBusy("download"); setMsg(null);
    try { await downloadMyData(patientId); setMsg({ tone: "success", text: "Your data was downloaded to this device. Keep the file somewhere safe — it contains your health information." }); }
    catch (e) { setMsg({ tone: "danger", text: friendlyError(e, "We couldn't prepare your download. Please try again.") }); }
    setBusy("");
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy("request"); setMsg(null);
    try {
      const r = await createDataRequest(kind, details.trim());
      setDetails("");
      setMsg({
        tone: "success",
        text: r.kind === "Deletion" && r.retain_until
          ? `Your deletion request is logged. Medical records must be kept until ${formatClinicDate(r.retain_until)} (7 years after your last visit), so it is scheduled for then.`
          : "Your request is logged. The clinic will review it.",
      });
      load();
    } catch (err) { setMsg({ tone: "danger", text: friendlyError(err, "We couldn't send your request. Please try again.") }); }
    setBusy("");
  }

  if (loadError) return <FormAlert>Your privacy settings didn&apos;t load. Refresh the page to try again.</FormAlert>;
  if (!state) return <p className="text-body-md text-on-surface-variant" role="status">Loading…</p>;

  const consented = Boolean(state.consented_at);
  return (
    <div className="space-y-lg">
      {msg && <FormAlert tone={msg.tone}>{msg.text}</FormAlert>}

      <section className="space-y-sm" aria-labelledby="consent-h">
        <h2 id="consent-h" className="text-headline-sm text-on-surface">Your consent</h2>
        {consented ? (
          <FormAlert tone="success">
            You agreed to the privacy notice (version <span className="tabular-nums">{state.consent_version}</span>) on {formatClinicDateTime(state.consented_at)}.
          </FormAlert>
        ) : state.consent_withdrawn_at ? (
          <FormAlert tone="warning">You withdrew your consent on {formatClinicDateTime(state.consent_withdrawn_at)}.</FormAlert>
        ) : (
          <FormAlert tone="warning">You haven&apos;t agreed to the current privacy notice yet.</FormAlert>
        )}
        <div className="flex flex-wrap gap-sm">
          <Link href="/patient/privacy-consent" className={buttonStyles(consented ? "secondary" : "primary")}>
            {consented ? "Read the policy" : "Review and agree"}
          </Link>
          {consented && !confirmWithdraw && (
            <Button variant="secondary" onClick={() => setConfirmWithdraw(true)}>Withdraw my consent</Button>
          )}
        </div>
        {confirmWithdraw && (
          <div className="space-y-sm rounded-lg border border-outline-variant p-md">
            <p className="text-body-md text-on-surface">Withdrawing does not delete your records. The clinic may be unable to book new visits until you agree again.</p>
            <div className="flex flex-wrap gap-sm">
              <Button variant="danger" loading={busy === "withdraw"} onClick={withdraw}>Yes, withdraw</Button>
              <Button variant="secondary" disabled={busy === "withdraw"} onClick={() => setConfirmWithdraw(false)}>Keep my consent</Button>
            </div>
          </div>
        )}
        {history.length > 0 && (
          <details className="text-body-md">
            <summary className="cursor-pointer text-on-surface-variant">Your past choices ({history.length})</summary>
            <ul className="mt-xs divide-y divide-outline-variant">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-sm py-xs">
                  <span>{h.decision} · version {h.consent_version}</span>
                  <span className="tabular-nums text-on-surface-variant">{formatClinicDateTime(h.decided_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-label-md text-on-surface-variant">
          <a href="/api/public/privacy-notice" target="_blank" className="underline" rel="noopener">Privacy Notice</a>{" · "}
          <a href="/api/public/privacy-notice?lang=fil" target="_blank" className="underline" lang="fil" rel="noopener">Paunawa sa Privacy (Filipino)</a>
        </p>
      </section>

      <section className="space-y-sm" aria-labelledby="download-h">
        <h2 id="download-h" className="text-headline-sm text-on-surface">Download my data</h2>
        <p className="text-body-md text-on-surface-variant">Get a copy of everything the clinic holds about you as a file you can keep.</p>
        <Button variant="secondary" loading={busy === "download"} onClick={download}>Download my data</Button>
      </section>

      <section className="space-y-sm" aria-labelledby="request-h">
        <h2 id="request-h" className="text-headline-sm text-on-surface">Correct or delete my data</h2>
        <form className="space-y-sm" onSubmit={submitRequest}>
          <fieldset className="flex flex-wrap gap-md">
            <legend className="sr-only">Type of request</legend>
            {(["Correction", "Deletion"] as const).map((k) => (
              <label key={k} className="flex items-center gap-xs text-body-md text-on-surface">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4 accent-primary" />
                {k === "Correction" ? "Request a correction" : "Request deletion"}
              </label>
            ))}
          </fieldset>
          <div className="space-y-xs">
            <label htmlFor="req-details" className={labelStyles}>{kind === "Correction" ? "What should be corrected?" : "Why do you want your data deleted? (optional details help us)"}</label>
            <textarea id="req-details" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className={inputStyles()} />
          </div>
          {kind === "Deletion" && (
            <p className="text-label-md text-on-surface-variant">Medical records must be kept for 7 years after your last visit. We will log your request and carry it out when that period ends.</p>
          )}
          <Button type="submit" variant="secondary" loading={busy === "request"} disabled={!details.trim()}>Send request</Button>
        </form>
        {requests.length > 0 && (
          <ul className="divide-y divide-outline-variant text-body-md">
            {requests.map((r) => (
              <li key={r.id} className="py-xs">
                <span className="text-on-surface">{r.kind} · {r.status}</span>
                <span className="ml-xs tabular-nums text-on-surface-variant">requested {formatClinicDate(r.requested_at)}{r.retain_until ? ` · record kept until ${formatClinicDate(r.retain_until)}` : ""}</span>
                {r.resolution_note && <p className="text-label-md text-on-surface-variant">Clinic note: {r.resolution_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
// JJQR - END
