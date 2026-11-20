"use client";

//JJQR - AI (Nov 20, 2026) C1 C2
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { queryIcd10Codes, type Icd10CodeRow } from "@/lib/data/lookups";
import type { DiagnosisTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export function isExactSavedDiagnosis(text: string, saved: DiagnosisTemplateRow[]): boolean {
  const n = text.trim().toLowerCase();
  if (!n) return false;
  return saved.some((t) => t.label.trim().toLowerCase() === n || t.body.trim().toLowerCase() === n);
}

type Option =
  | { kind: "saved"; key: string; template: DiagnosisTemplateRow }
  | { kind: "icd"; key: string; row: Icd10CodeRow }
  | { kind: "save"; key: "save"; text: string };

export interface DiagnosisComboboxProps {
  saved: DiagnosisTemplateRow[];
  onAdd: (text: string, icd10Code: string | null) => void;
  onPickSaved: (template: DiagnosisTemplateRow) => void;
  onSaveToMyDiagnoses: (text: string) => Promise<void>;
}

function highlightIndex(options: Option[], activeKey: string | null): number {
  if (options.length === 0) return -1;
  const byKey = activeKey ? options.findIndex((o) => o.key === activeKey) : -1;
  if (byKey >= 0) return byKey;
  const firstPick = options.findIndex((o) => o.kind !== "save");
  return firstPick >= 0 ? firstPick : 0;
}

export function DiagnosisCombobox({ saved, onAdd, onPickSaved, onSaveToMyDiagnoses }: DiagnosisComboboxProps) {
  const uid = useId();
  const listboxId = `${uid}-dx-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [icd, setIcd] = useState<{ q: string; rows: Icd10CodeRow[] }>({ q: "", rows: [] });
  const [saving, setSaving] = useState(false);
  const trimmed = query.trim();

  const savedMatches = saved.filter((t) => matchesQuery(query, t.label, t.body, t.icd10_code));
  const showSaveOption = trimmed.length > 0 && !isExactSavedDiagnosis(trimmed, saved);
  const icdRows = icd.q === trimmed ? icd.rows : [];

  const options: Option[] = [];
  for (const template of savedMatches) options.push({ kind: "saved", key: `saved-${template.id}`, template });
  for (const row of icdRows) options.push({ kind: "icd", key: `icd-${row.code}`, row });
  if (showSaveOption) options.push({ kind: "save", key: "save", text: trimmed });

  const activeIndex = highlightIndex(options, activeKey);

  useEffect(() => {
    const q = trimmed;
    if (q.length < 1) return;
    let cancelled = false;
    const t = setTimeout(() => {
      queryIcd10Codes(null, q)
        .then((rows) => {
          if (!cancelled) setIcd({ q, rows: rows.slice(0, 20) });
        })
        .catch(() => {
          if (!cancelled) setIcd({ q, rows: [] });
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function clearAndFocus() {
    setQuery("");
    setIcd({ q: "", rows: [] });
    setActiveKey(null);
    setOpen(false);
    inputRef.current?.focus();
  }

  async function commitOption(opt: Option) {
    if (opt.kind === "saved") {
      onPickSaved(opt.template);
      clearAndFocus();
      return;
    }
    if (opt.kind === "icd") {
      onAdd(opt.row.description, opt.row.code);
      clearAndFocus();
      return;
    }
    setSaving(true);
    try {
      await onSaveToMyDiagnoses(opt.text);
      clearAndFocus();
    } finally {
      setSaving(false);
    }
  }

  //JJQR - AI (Nov 20, 2026) C1 — Add (and Enter with nothing highlighted) keeps typed free text + Primary/Secondary behaviour
  function commitTypedFreeText() {
    if (!trimmed) return;
    onAdd(trimmed, null);
    clearAndFocus();
  }

  function commitEnter() {
    if (open && activeIndex >= 0 && options[activeIndex]) {
      void commitOption(options[activeIndex]);
      return;
    }
    commitTypedFreeText();
  }

  const listOpen = open && !saving && options.length > 0;
  const activeId = listOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;
  const savedCount = savedMatches.length;
  const icdStart = savedCount;
  const icdCount = icdRows.length;

  return (
    <div ref={rootRef} className="flex w-full flex-col gap-sm sm:flex-row sm:items-end">
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          id={`${uid}-dx-input`}
          type="text"
          role="combobox"
          name="diagnosis"
          aria-label="Diagnosis (search ICD-10 or saved)"
          aria-expanded={listOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          disabled={saving}
          value={query}
          placeholder="Diagnosis (search ICD-10 or saved)"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveKey(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setActiveKey(null);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              if (options.length === 0) return;
              const next = activeIndex < 0 ? 0 : (activeIndex + 1) % options.length;
              setActiveKey(options[next]!.key);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (options.length === 0) return;
              const next = activeIndex <= 0 ? options.length - 1 : activeIndex - 1;
              setActiveKey(options[next]!.key);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              commitEnter();
            }
          }}
          className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
        />
        {listOpen && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-xs max-h-72 w-full overflow-auto rounded-lg border border-outline-variant bg-surface shadow-md"
          >
            {savedCount > 0 && (
              <li role="presentation" className="px-md py-xs text-label-sm font-semibold text-on-surface-variant">
                My diagnoses
              </li>
            )}
            {options.map((opt, i) => (
              <Fragment key={opt.key}>
                {opt.kind === "icd" && i === icdStart && icdCount > 0 && (
                  <li role="presentation" className="px-md py-xs text-label-sm font-semibold text-on-surface-variant">
                    ICD-10
                  </li>
                )}
                <li
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    "cursor-pointer px-md py-sm text-left text-body-md",
                    i === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-surface-container-low",
                  )}
                  onMouseEnter={() => setActiveKey(opt.key)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void commitOption(opt)}
                >
                  {opt.kind === "saved" && (
                    <>
                      {opt.template.label}
                      {opt.template.icd10_code ? ` (${opt.template.icd10_code})` : ""}
                      {" — "}
                      {opt.template.body}
                    </>
                  )}
                  {opt.kind === "icd" && (
                    <>
                      {opt.row.code} {opt.row.description}
                    </>
                  )}
                  {opt.kind === "save" && <>{`Save "${opt.text}" to my diagnoses`}</>}
                </li>
              </Fragment>
            ))}
          </ul>
        )}
      </div>
      {/*JJQR - AI (Nov 20, 2026) C1 — Add commits typed free text; Enter still takes the highlighted option */}
      <Button variant="secondary" className="min-h-[44px]" disabled={saving || !trimmed} onClick={commitTypedFreeText}>
        Add
      </Button>
    </div>
  );
}
//JJQR - END
