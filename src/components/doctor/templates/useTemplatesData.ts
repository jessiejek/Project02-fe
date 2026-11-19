"use client";
//JJQR - AI (Nov 19, 2026) - new file: loads the six template lists (+ medicine catalog) independently for the workspace
import { queryFavoriteMedicines, queryRxTemplates, querySoapPhrases } from "@/lib/data/clinical";
import { queryMedicines } from "@/lib/data/lookups";
import { useLoadedList, useTemplateLibrary } from "@/lib/clinical/useTemplateLibrary";
import type { RxTemplateRow, FavoriteMedicineRow, SoapPhraseRow } from "@/lib/data/clinical";
import type { MedicineOption, TemplatesData } from "./types";

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

export function useTemplatesData(doctorId: string | undefined): TemplatesData {
  const enabled = !!doctorId;
  const { soap, certs, diagnoses } = useTemplateLibrary(doctorId);
  // Phrases + favorites keep the server's sort_order; Rx sets sort by title.
  const phrases = useLoadedList<SoapPhraseRow>(enabled, doctorId, () => querySoapPhrases(null, doctorId as string));
  const rx = useLoadedList<RxTemplateRow>(enabled, doctorId, () => queryRxTemplates(null, doctorId), byTitle);
  const favorites = useLoadedList<FavoriteMedicineRow>(enabled, doctorId, () => queryFavoriteMedicines(null, doctorId as string));
  const medicines = useLoadedList<MedicineOption>(enabled, doctorId, async () => (await queryMedicines()).map((m) => ({ id: m.medicine_id, generic_name: m.generic_name })));
  return { soap, phrases, rx, favorites, diagnoses, certs, medicines };
}
//JJQR - END
