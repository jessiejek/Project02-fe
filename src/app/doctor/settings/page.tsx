"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useSession } from "@/components/providers/SessionProvider";
import { TemplateManager } from "@/components/doctor/TemplateManager";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { queryMedicines } from "@/lib/data/lookups";
import {
  queryDiagnosisTemplates,
  createDiagnosisTemplate,
  updateDiagnosisTemplate,
  deleteDiagnosisTemplate,
  type DiagnosisTemplateRow,
  querySoapPhrases,
  createSoapPhrase,
  updateSoapPhrase,
  deleteSoapPhrase,
  type SoapPhraseRow,
  querySoapTemplates,
  createSoapTemplate,
  updateSoapTemplate,
  deleteSoapTemplate,
  type SoapTemplateRow,
  queryFavoriteMedicines,
  addFavoriteMedicine,
  updateFavoriteMedicine,
  deleteFavoriteMedicine,
  type FavoriteMedicineRow,
  queryRxTemplates,
  createRxTemplate,
  updateRxTemplate,
  deleteRxTemplate,
  type RxTemplateRow,
  type RxItem,
  queryMedicalCertificateTemplates,
  createMedicalCertificateTemplate,
  updateMedicalCertificateTemplate,
  deleteMedicalCertificateTemplate,
  type MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";

const NIL = "00000000-0000-0000-0000-000000000000";

const SOAP_FIELDS: { value: string; label: string }[] = [
  { value: "ChiefComplaint", label: "Chief Complaint" },
  { value: "Subjective", label: "Subjective (history)" },
  { value: "Objective", label: "Objective (exam findings)" },
  { value: "Assessment", label: "Assessment" },
  { value: "Plan", label: "Plan" },
];
const soapFieldLabel = (v: string) => SOAP_FIELDS.find((f) => f.value === v)?.label ?? v;

const inputCls =
  "w-full rounded-lg border border-outline-variant px-md py-sm text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelCls = "mb-xs block text-label-md text-on-surface-variant";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

// ── drafts ────────────────────────────────────────────────────────────────
interface DiagnosisDraft { label: string; body: string }
interface PhraseDraft { field: string; label: string; body: string }
interface NoteDraft {
  title: string; chief_complaint: string; subjective: string;
  objective: string; assessment: string; plan: string;
}
interface FavDraft { rxId: string; generic_name: string; dosage: string; quantity: string; instruction: string }
interface RxLine { rxId: string; genericName: string; dosage: string; quantity: string; instruction: string }
interface RxDraft { title: string; items: RxLine[] }
interface McDraft { title: string; diagnosis_text: string; recommendations: string; purpose_exception: string }

export default function DoctorSettingsPage() {
  const { session, loading: sessionLoading } = useSession();
  const doctorId = session?.staffId ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [medicines, setMedicines] = useState<{ id: string; generic_name: string }[]>([]);

  const [diagnoses, setDiagnoses] = useState<DiagnosisTemplateRow[]>([]);
  const [phrases, setPhrases] = useState<SoapPhraseRow[]>([]);
  const [notes, setNotes] = useState<SoapTemplateRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMedicineRow[]>([]);
  const [rxSets, setRxSets] = useState<RxTemplateRow[]>([]);
  const [mcTemplates, setMcTemplates] = useState<MedicalCertificateTemplateRow[]>([]);

  useEffect(() => {
    if (sessionLoading) return;
    (async () => {
      if (!doctorId) {
        setLoadError("Could not identify your doctor account.");
        setLoading(false);
        return;
      }
      try {
        const [dx, ph, nt, fav, rx, meds, mc] = await Promise.all([
          queryDiagnosisTemplates(),
          querySoapPhrases(null as never, doctorId),
          querySoapTemplates(null as never, doctorId),
          queryFavoriteMedicines(null as never, doctorId),
          queryRxTemplates(null as never, doctorId),
          queryMedicines(null as never),
          queryMedicalCertificateTemplates(null as never, doctorId),
        ]);
        setDiagnoses(dx);
        setPhrases(ph);
        setNotes(nt.filter((t) => !t.is_system_template));
        setFavorites(fav);
        setRxSets(rx.filter((t) => !t.is_system_template));
        setMedicines(meds.map((m) => ({ id: m.medicine_id, generic_name: m.generic_name })));
        setMcTemplates(mc.filter((t) => !t.is_system_template));
      } catch {
        setLoadError("Could not load your templates. Refresh to try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [doctorId, sessionLoading]);

  const bySortedLabel = <T extends { label?: string; title?: string; generic_name?: string }>(a: T, b: T) =>
    (a.label ?? a.title ?? a.generic_name ?? "").localeCompare(b.label ?? b.title ?? b.generic_name ?? "");

  const rxItemsFromLines = (items: RxLine[]): Omit<RxItem, "id">[] =>
    items
      .filter((i) => i.genericName.trim())
      .map((i) => ({
        medicine_id: i.rxId || NIL,
        generic_name: i.genericName.trim(),
        dosage: i.dosage.trim(),
        quantity: i.quantity.trim(),
        instruction: i.instruction.trim() || null,
        is_controlled_substance: false,
      }));

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[46rem] space-y-lg">
        <div>
          <h1 className="text-headline-lg text-on-surface">Settings</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">
            Set up the text you reuse during a consultation, so you can pick it from a list
            instead of typing it every time. Everything here is only for your account.
          </p>
        </div>

        {loadError && (
          <p className="rounded-lg bg-error-container px-md py-sm text-body-md text-on-error-container">{loadError}</p>
        )}

        {loading ? (
          <div className="space-y-lg">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        ) : (
          <div className="space-y-lg">
            {/* 1. Diagnoses */}
            <TemplateManager<DiagnosisTemplateRow, DiagnosisDraft>
              title="Saved diagnoses"
              description="Shows up in the Diagnosis step of a consultation. Pick one to add it as a diagnosis line."
              itemNoun="diagnosis"
              items={[...diagnoses].sort(bySortedLabel)}
              getId={(t) => t.id}
              renderSummary={(t) => (
                <span><strong>{t.label}</strong>{" — "}{t.body}</span>
              )}
              emptyDraft={{ label: "", body: "" }}
              toDraft={(t) => ({ label: t.label, body: t.body })}
              isValid={(d) => !!d.label.trim() && !!d.body.trim()}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Short label (what you see in the list)">
                    <input className={inputCls} value={d.label} onChange={(e) => set({ ...d, label: e.target.value })} placeholder="e.g. URTI" />
                  </Field>
                  <Field label="Diagnosis text (goes onto the record)">
                    <textarea className={inputCls} rows={2} value={d.body} onChange={(e) => set({ ...d, body: e.target.value })} />
                  </Field>
                </div>
              )}
              onCreate={async (d) => {
                const c = await createDiagnosisTemplate(null as never, { label: d.label.trim(), body: d.body.trim() });
                setDiagnoses((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateDiagnosisTemplate(null as never, id, { label: d.label.trim(), body: d.body.trim() });
                setDiagnoses((p) => p.map((x) => (x.id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteDiagnosisTemplate(null as never, id);
                setDiagnoses((p) => p.filter((x) => x.id !== id));
              }}
            />

            {/* 2. SOAP quick phrases */}
            <TemplateManager<SoapPhraseRow, PhraseDraft>
              title="Quick phrases for notes"
              description="Short bits of text for the note boxes (Chief Complaint, Subjective, etc.). Insert one with the + button next to each box during a consultation."
              itemNoun="phrase"
              items={[...phrases].sort(bySortedLabel)}
              getId={(p) => p.id}
              renderSummary={(p) => (
                <span><span className="text-label-md text-on-surface-variant">[{soapFieldLabel(p.field)}]</span> <strong>{p.label}</strong>{" — "}{p.body}</span>
              )}
              emptyDraft={{ field: "ChiefComplaint", label: "", body: "" }}
              toDraft={(p) => ({ field: p.field, label: p.label, body: p.body })}
              isValid={(d) => !!d.field && !!d.label.trim() && !!d.body.trim()}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Which note box is this for?">
                    <select className={inputCls} value={d.field} onChange={(e) => set({ ...d, field: e.target.value })}>
                      {SOAP_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Short label (what you see in the list)">
                    <input className={inputCls} value={d.label} onChange={(e) => set({ ...d, label: e.target.value })} placeholder='e.g. "Normal chest exam"' />
                  </Field>
                  <Field label="The text to insert">
                    <textarea className={inputCls} rows={2} value={d.body} onChange={(e) => set({ ...d, body: e.target.value })} />
                  </Field>
                </div>
              )}
              onCreate={async (d) => {
                const c = await createSoapPhrase(null as never, doctorId, { field: d.field, label: d.label.trim(), body: d.body.trim() });
                setPhrases((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateSoapPhrase(null as never, id, { field: d.field, label: d.label.trim(), body: d.body.trim() });
                setPhrases((p) => p.map((x) => (x.id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteSoapPhrase(null as never, id);
                setPhrases((p) => p.filter((x) => x.id !== id));
              }}
            />

            {/* 3. Full note templates */}
            <TemplateManager<SoapTemplateRow, NoteDraft>
              title="Full note templates"
              description={'A whole note filled in at once — every box (Chief Complaint through Plan). Choose one from "Use Template…" at the top of the consultation notes.'}
              itemNoun="note template"
              items={[...notes].sort(bySortedLabel)}
              getId={(t) => t.id}
              renderSummary={(t) => (
                <span><strong>{t.title}</strong>{t.chief_complaint ? ` — ${t.chief_complaint}` : ""}</span>
              )}
              emptyDraft={{ title: "", chief_complaint: "", subjective: "", objective: "", assessment: "", plan: "" }}
              toDraft={(t) => ({
                title: t.title,
                chief_complaint: t.chief_complaint ?? "",
                subjective: t.subjective ?? "",
                objective: t.objective ?? "",
                assessment: t.assessment ?? "",
                plan: t.plan ?? "",
              })}
              isValid={(d) => !!d.title.trim()}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Template name">
                    <input className={inputCls} value={d.title} onChange={(e) => set({ ...d, title: e.target.value })} placeholder='e.g. "Adult check-up — normal"' />
                  </Field>
                  <Field label="Chief Complaint">
                    <textarea className={inputCls} rows={2} value={d.chief_complaint} onChange={(e) => set({ ...d, chief_complaint: e.target.value })} />
                  </Field>
                  <Field label="Subjective (history)">
                    <textarea className={inputCls} rows={2} value={d.subjective} onChange={(e) => set({ ...d, subjective: e.target.value })} />
                  </Field>
                  <Field label="Objective (exam findings)">
                    <textarea className={inputCls} rows={2} value={d.objective} onChange={(e) => set({ ...d, objective: e.target.value })} />
                  </Field>
                  <Field label="Assessment">
                    <textarea className={inputCls} rows={2} value={d.assessment} onChange={(e) => set({ ...d, assessment: e.target.value })} />
                  </Field>
                  <Field label="Plan">
                    <textarea className={inputCls} rows={2} value={d.plan} onChange={(e) => set({ ...d, plan: e.target.value })} />
                  </Field>
                </div>
              )}
              onCreate={async (d) => {
                const c = await createSoapTemplate(null as never, doctorId, {
                  title: d.title.trim(), is_system_template: false,
                  chief_complaint: d.chief_complaint.trim() || null,
                  subjective: d.subjective.trim() || null,
                  objective: d.objective.trim() || null,
                  assessment: d.assessment.trim() || null,
                  plan: d.plan.trim() || null,
                });
                setNotes((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateSoapTemplate(null as never, id, {
                  title: d.title.trim(), is_system_template: false,
                  chief_complaint: d.chief_complaint.trim() || null,
                  subjective: d.subjective.trim() || null,
                  objective: d.objective.trim() || null,
                  assessment: d.assessment.trim() || null,
                  plan: d.plan.trim() || null,
                });
                setNotes((p) => p.map((x) => (x.id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteSoapTemplate(null as never, id);
                setNotes((p) => p.filter((x) => x.id !== id));
              }}
            />

            {/* 4. Favourite medicines */}
            <TemplateManager<FavoriteMedicineRow, FavDraft>
              title="Favourite medicines"
              description="One-tap medicines for the Prescription step. Add the medicine name, its dose, how many, and the directions."
              itemNoun="medicine"
              items={[...favorites].sort(bySortedLabel)}
              getId={(f) => f.id}
              renderSummary={(f) => (
                <span><strong>{f.generic_name}</strong> {f.dosage} · {f.quantity}{f.instruction ? ` · ${f.instruction}` : ""}</span>
              )}
              emptyDraft={{ rxId: "", generic_name: "", dosage: "", quantity: "", instruction: "" }}
              toDraft={(f) => ({
                rxId: f.medicine_id && f.medicine_id !== NIL ? f.medicine_id : "",
                generic_name: f.generic_name, dosage: f.dosage, quantity: f.quantity, instruction: f.instruction ?? "",
              })}
              isValid={(d) => !!d.generic_name.trim() && !!d.dosage.trim() && !!d.quantity.trim()}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Medicine name">
                    <input
                      className={inputCls} list="settings-medicines" value={d.generic_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const match = medicines.find((m) => m.generic_name.toLowerCase() === name.toLowerCase());
                        set({ ...d, generic_name: name, rxId: match?.id ?? "" });
                      }}
                      placeholder="Start typing…"
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                    <Field label="Dose (e.g. 500 mg)">
                      <input className={inputCls} value={d.dosage} onChange={(e) => set({ ...d, dosage: e.target.value })} />
                    </Field>
                    <Field label="How many (e.g. 20 tablets)">
                      <input className={inputCls} value={d.quantity} onChange={(e) => set({ ...d, quantity: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Directions (e.g. 1 tablet 3× a day after meals)">
                    <input className={inputCls} value={d.instruction} onChange={(e) => set({ ...d, instruction: e.target.value })} />
                  </Field>
                </div>
              )}
              onCreate={async (d) => {
                const c = await addFavoriteMedicine(null as never, doctorId, {
                  medicine_id: d.rxId || NIL, generic_name: d.generic_name.trim(),
                  dosage: d.dosage.trim(), quantity: d.quantity.trim(), instruction: d.instruction.trim() || null,
                });
                setFavorites((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateFavoriteMedicine(null as never, id, {
                  medicine_id: d.rxId || NIL, generic_name: d.generic_name.trim(),
                  dosage: d.dosage.trim(), quantity: d.quantity.trim(), instruction: d.instruction.trim() || null,
                });
                setFavorites((p) => p.map((x) => (x.id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteFavoriteMedicine(null as never, id);
                setFavorites((p) => p.filter((x) => x.id !== id));
              }}
            />

            {/* 5. Prescription sets */}
            <TemplateManager<RxTemplateRow, RxDraft>
              title="Prescription sets"
              description="A group of medicines you often prescribe together. Load the whole set at once from the Prescription step."
              itemNoun="prescription set"
              items={[...rxSets].sort(bySortedLabel)}
              getId={(t) => t.template_id}
              renderSummary={(t) => (
                <div>
                  <strong>{t.title}</strong>
                  <ul className="mt-xs list-disc pl-lg text-body-md text-on-surface-variant">
                    {(t.prescription_template_items ?? []).map((i, n) => (
                      <li key={n}>{i.generic_name} {i.dosage} · {i.quantity}{i.instruction ? ` · ${i.instruction}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
              emptyDraft={{ title: "", items: [{ rxId: "", genericName: "", dosage: "", quantity: "", instruction: "" }] }}
              toDraft={(t) => ({
                title: t.title,
                items: (t.prescription_template_items ?? []).map((i) => ({
                  rxId: i.medicine_id && i.medicine_id !== NIL ? i.medicine_id : "",
                  genericName: i.generic_name, dosage: i.dosage, quantity: i.quantity, instruction: i.instruction ?? "",
                })),
              })}
              isValid={(d) => !!d.title.trim() && d.items.some((i) => i.genericName.trim())}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Set name">
                    <input className={inputCls} value={d.title} onChange={(e) => set({ ...d, title: e.target.value })} placeholder='e.g. "Cough & cold — adult"' />
                  </Field>
                  <div className="space-y-md">
                    {d.items.map((line, idx) => (
                      <div key={idx} className="rounded-lg border border-outline-variant p-sm space-y-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-label-md text-on-surface-variant">Medicine {idx + 1}</span>
                          {d.items.length > 1 && (
                            <button
                              type="button"
                              className="text-label-md text-primary hover:underline"
                              onClick={() => set({ ...d, items: d.items.filter((_, i) => i !== idx) })}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          className={inputCls} list="settings-medicines" placeholder="Medicine name" value={line.genericName}
                          onChange={(e) => {
                            const name = e.target.value;
                            const match = medicines.find((m) => m.generic_name.toLowerCase() === name.toLowerCase());
                            const items = d.items.slice();
                            items[idx] = { ...line, genericName: name, rxId: match?.id ?? "" };
                            set({ ...d, items });
                          }}
                        />
                        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                          <input className={inputCls} placeholder="Dose (e.g. 500 mg)" value={line.dosage}
                            onChange={(e) => { const items = d.items.slice(); items[idx] = { ...line, dosage: e.target.value }; set({ ...d, items }); }} />
                          <input className={inputCls} placeholder="How many (e.g. 20 tablets)" value={line.quantity}
                            onChange={(e) => { const items = d.items.slice(); items[idx] = { ...line, quantity: e.target.value }; set({ ...d, items }); }} />
                        </div>
                        <input className={inputCls} placeholder="Directions" value={line.instruction}
                          onChange={(e) => { const items = d.items.slice(); items[idx] = { ...line, instruction: e.target.value }; set({ ...d, items }); }} />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-label-md text-primary hover:underline"
                      onClick={() => set({ ...d, items: [...d.items, { rxId: "", genericName: "", dosage: "", quantity: "", instruction: "" }] })}
                    >
                      + Add another medicine
                    </button>
                  </div>
                </div>
              )}
              onCreate={async (d) => {
                const c = await createRxTemplate(null as never, doctorId, {
                  title: d.title.trim(), is_system_template: false, items: rxItemsFromLines(d.items),
                });
                setRxSets((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateRxTemplate(null as never, id, doctorId, {
                  title: d.title.trim(), is_system_template: false, items: rxItemsFromLines(d.items),
                });
                setRxSets((p) => p.map((x) => (x.template_id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteRxTemplate(null as never, id);
                setRxSets((p) => p.filter((x) => x.template_id !== id));
              }}
            />

            {/* 6. Medical certificate templates */}
            <TemplateManager<MedicalCertificateTemplateRow, McDraft>
              title="Medical certificate templates"
              description={'Canned reasons for a medical certificate. Choose one from "Use Template…" in the Medical Certificate step — dates and the patient\'s address always stay per-issuance, never templated.'}
              itemNoun="certificate template"
              items={[...mcTemplates].sort(bySortedLabel)}
              getId={(t) => t.id}
              renderSummary={(t) => (
                <span><strong>{t.title}</strong>{t.diagnosis_text ? ` — ${t.diagnosis_text}` : ""}</span>
              )}
              emptyDraft={{ title: "", diagnosis_text: "", recommendations: "", purpose_exception: "" }}
              toDraft={(t) => ({
                title: t.title,
                diagnosis_text: t.diagnosis_text ?? "",
                recommendations: t.recommendations ?? "",
                purpose_exception: t.purpose_exception ?? "",
              })}
              isValid={(d) => !!d.title.trim()}
              renderForm={(d, set) => (
                <div className="space-y-md">
                  <Field label="Template name">
                    <input className={inputCls} value={d.title} onChange={(e) => set({ ...d, title: e.target.value })} placeholder='e.g. "Fit to Work"' />
                  </Field>
                  <Field label="Diagnosis / Impressions">
                    <textarea className={inputCls} rows={2} value={d.diagnosis_text} onChange={(e) => set({ ...d, diagnosis_text: e.target.value })} />
                  </Field>
                  <Field label="Recommendations">
                    <textarea className={inputCls} rows={2} value={d.recommendations} onChange={(e) => set({ ...d, recommendations: e.target.value })} />
                  </Field>
                  <Field label="Purpose exception (the “except ___” blank)">
                    <input className={inputCls} value={d.purpose_exception} onChange={(e) => set({ ...d, purpose_exception: e.target.value })} />
                  </Field>
                </div>
              )}
              onCreate={async (d) => {
                const c = await createMedicalCertificateTemplate(null as never, doctorId, {
                  title: d.title.trim(), is_system_template: false,
                  diagnosis_text: d.diagnosis_text.trim() || null,
                  recommendations: d.recommendations.trim() || null,
                  purpose_exception: d.purpose_exception.trim() || null,
                });
                setMcTemplates((p) => [...p, c]);
              }}
              onUpdate={async (id, d) => {
                const u = await updateMedicalCertificateTemplate(null as never, id, {
                  title: d.title.trim(), is_system_template: false,
                  diagnosis_text: d.diagnosis_text.trim() || null,
                  recommendations: d.recommendations.trim() || null,
                  purpose_exception: d.purpose_exception.trim() || null,
                });
                setMcTemplates((p) => p.map((x) => (x.id === id ? u : x)));
              }}
              onDelete={async (id) => {
                await deleteMedicalCertificateTemplate(null as never, id);
                setMcTemplates((p) => p.filter((x) => x.id !== id));
              }}
            />
          </div>
        )}

        <datalist id="settings-medicines">
          {medicines.map((m) => <option key={m.id} value={m.generic_name} />)}
        </datalist>
      </div>
    </AppShell>
  );
}
