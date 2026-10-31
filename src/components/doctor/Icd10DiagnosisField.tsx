"use client";

import { useEffect, useState } from "react";
import { queryIcd10Codes, type Icd10CodeRow } from "@/lib/data/lookups";
import { cn } from "@/lib/cn";

//JJQR - AI (Oct 31, 2026)
export interface Icd10DiagnosisFieldProps {
  description: string;
  icd10Code: string | null;
  onChange: (next: { description: string; icd10Code: string | null }) => void;
  disabled?: boolean;
  className?: string;
  //JJQR - AI (Oct 31, 2026)
  onEnterSubmit?: () => void;
  //JJQR - END
}

export function Icd10DiagnosisField({ description, icd10Code, onChange, disabled, className, onEnterSubmit }: Icd10DiagnosisFieldProps) {
  const [suggestions, setSuggestions] = useState<Icd10CodeRow[]>([]);
  const [open, setOpen] = useState(false);

  //JJQR - AI (Oct 31, 2026): parent owns description; no local query sync effect
  const trimmedQuery = description.trim();
  const visibleSuggestions = trimmedQuery.length < 2 ? [] : suggestions;

  useEffect(() => {
    let cancelled = false;
    const q = trimmedQuery;
    if (q.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      queryIcd10Codes(null, q)
        .then((rows) => {
          if (!cancelled) setSuggestions(rows.slice(0, 8));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmedQuery]);

  return (
    <div className={cn("relative space-y-xs", className)}>
      <input
        value={description}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ description: v, icd10Code: null });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnterSubmit) {
            e.preventDefault();
            onEnterSubmit();
          }
        }}
        placeholder="Diagnosis (search ICD-10 or free text)"
        className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
      />
      {icd10Code && (
        <p className="text-label-sm text-on-surface-variant">
          ICD-10: <span className="font-medium text-on-surface">{icd10Code}</span>
        </p>
      )}
      {open && visibleSuggestions.length > 0 && !disabled && (
        <ul className="absolute z-10 max-h-48 w-full overflow-auto rounded-lg border border-outline-variant bg-surface shadow-md">
          {visibleSuggestions.map((row) => (
            <li key={row.code}>
              <button
                type="button"
                className="block w-full px-md py-sm text-left text-body-md hover:bg-surface-container-low"
                onClick={() => {
                  onChange({ description: row.description, icd10Code: row.code });
                  setOpen(false);
                }}
              >
                <span className="font-medium">{row.code}</span> — {row.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
//JJQR - END
