//JJQR - AI (Nov 19, 2026) - new file: shared types for the templates workspace tabs
import type { Dispatch, SetStateAction } from "react";
import type {
  SoapTemplateRow, SoapPhraseRow, RxTemplateRow, FavoriteMedicineRow, DiagnosisTemplateRow, MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";
import type { LoadStatus } from "@/lib/clinical/useTemplateLibrary";
import type { ToastApi } from "@/components/ui/ToastHost";
import type { Specialty } from "@/lib/clinical/template-specialty";
import type { PhraseField } from "@/lib/templates/urlState";
import type { UndoableDeleteSpec } from "./useUndoableDelete";

export interface ListState<T> {
  items: T[];
  status: LoadStatus;
  reload: () => void;
  setItems: Dispatch<SetStateAction<T[]>>;
}

export interface MedicineOption { id: string; generic_name: string }

export interface TemplatesData {
  soap: ListState<SoapTemplateRow>;
  phrases: ListState<SoapPhraseRow>;
  rx: ListState<RxTemplateRow>;
  favorites: ListState<FavoriteMedicineRow>;
  diagnoses: ListState<DiagnosisTemplateRow>;
  certs: ListState<MedicalCertificateTemplateRow>;
  medicines: ListState<MedicineOption>;
}

export interface TabCtx {
  doctorId: string;
  data: TemplatesData;
  toast: ToastApi;
  /** Per-tab filter text (search box, "This tab" scope). */
  query: string;
  /** URL ?id=: "new" | an item id | null */
  panelId: string | null;
  /** URL ?field= (phrases) */
  field: PhraseField | null;
  specialty: Specialty | "All";
  setSpecialty: (s: Specialty | "All") => void;
  openPanel: (id: string, field?: string | null) => void;
  closePanel: () => void;
  deleteWithUndo: (spec: UndoableDeleteSpec) => void;
  isHidden: (id: string) => boolean;
}
//JJQR - END
