import type { APIRequestContext } from "@playwright/test";
import { cancelQueueEntry, checkInWalkIn, getDoctor, getQueue, manilaDate } from "./api";

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: build a finished visit through the API so portal pages have real data to show
export interface CompletedVisit {
  booking_id: string;
  consultation_id: string;
  queue_number: string;
  rx_group_id?: string;
  medicine?: string;
}

/**
 * check-in → consultation (Draft→Completed) with diagnosis + optional Rx / vaccination / vitals → queue "complete".
 * Same endpoints the UI calls; use for seeding portal pages, not for testing the consultation UI itself.
 */
export async function completeVisitViaApi(
  apis: { staff: APIRequestContext; doctor: APIRequestContext },
  patientId: string,
  opts: { complaint?: string; rx?: boolean; vaccine?: string; diagnosis?: string; leaveOpen?: boolean; bookingId?: string; pfDecision?: "Charge" | "Waive"; pfReason?: string } = {},
): Promise<CompletedVisit> {
  const { staff, doctor } = apis;
  const d = await getDoctor(staff);
  // an existing, already checked-in booking (journeys) or a fresh walk-in
  const q = opts.bookingId ? { booking_id: opts.bookingId, queue_number: "" } : await checkInWalkIn(staff, patientId);
  const complaint = opts.complaint ?? "E2E seeded complaint";
  const dr = (url: string, data: unknown, method: "put" | "post" = "put") => doctor[method](url, { data });

  const called = await staff.put(`/api/queue/${q.booking_id}/call`);
  if (!called.ok()) throw new Error(`call → ${called.status()} ${await called.text()}`);
  const c = await dr(`/api/consultations/by-booking/${q.booking_id}`, {
    patient_id: patientId, doctor_id: d.doctor_id, status: "Draft", chief_complaint: complaint,
    subjective: "E2E subjective", objective: "E2E objective", assessment: "E2E assessment", plan: "E2E plan",
  });
  if (!c.ok()) throw new Error(`consult draft → ${c.status()} ${await c.text()}`);
  const cid = (await c.json()).consultation_id as string;

  const dx = await dr(`/api/consultations/${cid}/diagnoses`, [{ custom_description: opts.diagnosis ?? "E2E acute pharyngitis", type: "Primary" }]);
  if (!dx.ok()) throw new Error(`dx → ${dx.status()} ${await dx.text()}`);

  // vitals: BP + pulse (the two the consultation gate wants)
  const tpls: any[] = await (await staff.get("/api/vital-field-templates")).json();
  const id = (key: string) => tpls.find((t) => t.form_key === key)?.template_id;
  const vit = await staff.put(`/api/vitals/by-booking/${q.booking_id}`, {
    data: [{ template_id: id("blood_pressure"), value: "118/76" }, { template_id: id("pulse_rate") ?? id("pulse"), value: "72" }].filter((x) => x.template_id),
  });
  if (!vit.ok()) throw new Error(`vitals → ${vit.status()} ${await vit.text()}`);

  let out: CompletedVisit = { booking_id: q.booking_id, consultation_id: cid, queue_number: q.queue_number };

  if (opts.rx) {
    const meds: any[] = await (await doctor.get("/api/medicines")).json();
    const m = (Array.isArray(meds) ? meds : (meds as any).items)[0];
    const rx = await doctor.put(`/api/prescription-groups/by-booking/${q.booking_id}`, {
      data: {
        patient_id: patientId, doctor_id: d.doctor_id, booking_id: q.booking_id,
        items: [{ medicine_id: m.medicine_id, generic_name: m.generic_name ?? m.name, dosage: "500 mg", quantity: "10", instruction: "E2E take with water", is_controlled_substance: false }],
      },
    });
    if (!rx.ok()) throw new Error(`rx → ${rx.status()} ${await rx.text()}`);
    const g = await rx.json();
    out = { ...out, rx_group_id: g.group_id ?? g[0]?.group_id, medicine: m.generic_name ?? m.name };
  }
  if (opts.vaccine) {
    const v = await dr(`/api/patient-vaccinations/by-consultation/${cid}`, [{ vaccine_name: opts.vaccine, dose_number: 1, route: "IM", site: "Left deltoid", lot_number: "LOT-E2E" }]);
    if (!v.ok()) throw new Error(`vaccine → ${v.status()} ${await v.text()}`);
  }
  const fu = await dr(`/api/follow-ups/by-consultation/${cid}`, { follow_up_date: manilaDate(7), notes: "E2E follow-up" });
  void fu; // best effort — not every deployment needs it

  if (!opts.leaveOpen) {
    const done = await dr(`/api/consultations/by-booking/${q.booking_id}`, {
      patient_id: patientId, doctor_id: d.doctor_id, status: "Completed", chief_complaint: complaint,
      subjective: "E2E subjective", objective: "E2E objective", assessment: "E2E assessment", plan: "E2E plan",
      ...(opts.pfDecision ? { pf_decision: opts.pfDecision, pf_waive_reason: opts.pfDecision === "Waive" ? (opts.pfReason ?? "E2E doctor waived") : null } : {}),
    });
    if (!done.ok()) throw new Error(`consult complete → ${done.status()} ${await done.text()}`);
    const qc = await staff.put(`/api/queue/${q.booking_id}/complete`);
    if (!qc.ok()) throw new Error(`queue complete → ${qc.status()} ${await qc.text()}`);
  }
  return out;
}
//JJQR - END

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: settle a seeded visit so test data does not pile up in the front-desk "Collect payments" list
/** Best-effort: record a cash payment for a still-unpaid booking (cleanup only). */
export async function settleViaApi(staff: APIRequestContext, bookingId: string): Promise<void> {
  const res = await staff.get(`/api/payments/booking/${bookingId}`);
  if (!res.ok()) return;
  const p = await res.json();
  if (p.status !== "Unpaid") return;
  await staff.post(`/api/payments/${p.payment_id}/confirm`, {
    data: { payment_method: "Cash", amount_received: p.amount, or_number: `E2E-CLEAN-${bookingId.slice(0, 8)}`, confirm_notes: "E2E cleanup", reference_number: null },
  }).catch(() => undefined);
}
//JJQR - END

//JJQR - AI (Nov 20, 2026) - batch 2: leftovers from earlier/aborted runs pile up in today's queue (56 unpaid completed visits at the time of writing) and push a fresh
// test row off paged / capped lists (e.g. the doctor dashboard "Needs attention" shows only the first 5). Sweep only rows whose patient name starts with "E2E".
export async function sweepE2eQueueLeftovers(staff: APIRequestContext): Promise<{ settled: number; cancelled: number }> {
  const { items } = await getQueue(staff);
  let settled = 0;
  let cancelled = 0;
  for (const it of items.filter((i) => /^E2E[ -]/.test(i.patient_name))) {
    if (it.status === "Completed" && Number(it.amount_due) > 0) {
      await settleViaApi(staff, it.booking_id);
      settled++;
    } else if (!["Completed", "Cancelled", "NoShow"].includes(it.status)) {
      await cancelQueueEntry(staff, it.booking_id, "E2E sweep");
      cancelled++;
    }
  }
  return { settled, cancelled };
}
//JJQR - END

//JJQR - AI (Nov 20, 2026) - F-1: B-06 allows one active booking per patient per day, so an E2E-tagged Pending booking left by a failed run blocks the next run
/** Cancel the signed-in patient's own still-open bookings whose notes start with "E2E " (best effort). */
export async function cancelOwnE2eBookings(patient: APIRequestContext): Promise<number> {
  const r = await patient.get("/api/bookings/me");
  if (!r.ok()) return 0;
  const { items } = (await r.json()) as { items: { booking_id: string; status: string; notes: string | null }[] };
  let n = 0;
  for (const b of items) {
    if (/^E2E /.test(b.notes ?? "") && ["Pending", "Confirmed"].includes(b.status)) {
      await patient.put(`/api/bookings/${b.booking_id}/cancel`, { data: { reason: "E2E sweep" } }).catch(() => undefined);
      n++;
    }
  }
  return n;
}
//JJQR - END
