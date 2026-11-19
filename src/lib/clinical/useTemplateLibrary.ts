"use client";
//JJQR - AI (Nov 19, 2026) - new file: shared template-library hook. Each list loads independently, so one failing list never blanks the page; phrase requests are de-duplicated.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  querySoapTemplates,
  querySoapPhrases,
  queryDiagnosisTemplates,
  queryMedicalCertificateTemplates,
  type SoapTemplateRow,
  type SoapPhraseRow,
  type DiagnosisTemplateRow,
  type MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface LoadedList<T> {
  items: T[];
  //JJQR - AI (Nov 19, 2026) - templates workspace edits lists in place (save / delete / reorder) without refetching
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  //JJQR - END
  status: LoadStatus;
  reload: () => void;
  /** Local add after a successful create (no refetch). */
  add: (row: T) => void;
}

export function useLoadedList<T>(enabled: boolean, scope: string | undefined, load: () => Promise<T[]>, sort?: (a: T, b: T) => number): LoadedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const loadRef = useRef(load);
  const seq = useRef(0);
  useEffect(() => { loadRef.current = load; });

  const fetchNow = useCallback(() => {
    const my = ++seq.current;
    loadRef.current().then(
      (rows) => { if (my === seq.current) { setItems(rows); setStatus("ready"); } },
      () => { if (my === seq.current) setStatus("error"); },
    );
  }, []);
  // Retry button: show "loading" right away (event handler, not an effect).
  const reload = useCallback(() => { setStatus("loading"); fetchNow(); }, [fetchNow]);

  useEffect(() => {
    if (!enabled) return;
    fetchNow();
    // seq is a request counter, not a DOM ref — bumping it on cleanup drops late responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { seq.current++; };
  }, [enabled, scope, fetchNow]);

  const add = useCallback((row: T) => {
    setItems((prev) => (sort ? [...prev, row].sort(sort) : [...prev, row]));
  }, [sort]);

  return { items, setItems, status: enabled && status === "idle" ? "loading" : status, reload, add };
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** SOAP templates + certificate templates + saved diagnoses for one doctor. Lists load independently. */
export function useTemplateLibrary(doctorId: string | undefined) {
  const enabled = !!doctorId;
  const soap = useLoadedList<SoapTemplateRow>(enabled, doctorId, () => querySoapTemplates(null, doctorId));
  const certs = useLoadedList<MedicalCertificateTemplateRow>(enabled, doctorId, () => queryMedicalCertificateTemplates(null, doctorId), byTitle);
  const diagnoses = useLoadedList<DiagnosisTemplateRow>(enabled, doctorId, () => queryDiagnosisTemplates(), byLabel);
  return { soap, certs, diagnoses };
}

// ── phrases: one request per doctor even when 5 toolbars mount at once ──────────
const phraseInflight = new Map<string, Promise<SoapPhraseRow[]>>();

/** Shares an in-flight request between callers (the 5 SOAP field toolbars). */
export function loadSoapPhrasesShared(doctorId: string): Promise<SoapPhraseRow[]> {
  const existing = phraseInflight.get(doctorId);
  if (existing) return existing;
  const p = querySoapPhrases(null, doctorId).finally(() => { phraseInflight.delete(doctorId); });
  phraseInflight.set(doctorId, p);
  return p;
}

/** Phrases of one SOAP field (DB enum casing, e.g. "ChiefComplaint"). */
export function useSoapPhrases(doctorId: string, dbField: string) {
  const [phrases, setPhrases] = useState<SoapPhraseRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const seq = useRef(0);
  const fetchNow = useCallback(() => {
    const my = ++seq.current;
    loadSoapPhrasesShared(doctorId).then(
      (all) => { if (my === seq.current) { setPhrases(all.filter((p) => p.field === dbField)); setStatus("ready"); } },
      () => { if (my === seq.current) setStatus("error"); },
    );
  }, [doctorId, dbField]);
  const reload = useCallback(() => { setStatus("loading"); fetchNow(); }, [fetchNow]);
  useEffect(() => {
    fetchNow();
    // seq is a request counter, not a DOM ref — bumping it on cleanup drops late responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { seq.current++; };
  }, [fetchNow]);
  const add = useCallback((row: SoapPhraseRow) => setPhrases((prev) => [...prev, row]), []);
  return { phrases, status, reload, add };
}
//JJQR - END
