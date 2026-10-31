"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useAppShellMobileNav } from "@/components/shell/AppShellMobileNavContext";

//JJQR - AI (Oct 31, 2026)
type SectionStatus = "complete" | "warning" | "partial" | "empty";

const STATUS_ICON: Record<SectionStatus, { icon: string; cls: string }> = {
  complete: { icon: "check_circle", cls: "text-green-600" },
  warning: { icon: "warning", cls: "text-amber-500" },
  partial: { icon: "incomplete_circle", cls: "text-blue-500" },
  empty: { icon: "radio_button_unchecked", cls: "text-on-surface-variant" },
};

export interface ConsultMobileSectionStepperProps {
  sections: readonly string[];
  sectionOrder: readonly number[];
  sectionStatus: SectionStatus[];
  openSection: number;
  onSelect: (index: number) => void;
  renderIndicator?: (sectionIndex: number, className: string) => ReactNode;
}

/** Below lg: open a bottom sheet to jump between consultation sections (F-011). */
export function ConsultMobileSectionStepper({
  sections,
  sectionOrder,
  sectionStatus,
  openSection,
  onSelect,
  renderIndicator,
}: ConsultMobileSectionStepperProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const mobileNav = useAppShellMobileNav();
  const openIdx = sectionOrder.indexOf(openSection);
  const position = openIdx >= 0 ? openIdx + 1 : 1;

  function openSheet() {
    mobileNav?.closeMobileNav();
    setSheetOpen(true);
  }

  function pickSection(i: number) {
    onSelect(i);
    setSheetOpen(false);
  }

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={openSheet}
        className="flex min-h-[44px] w-full items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-left text-label-md text-on-surface"
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
      >
        <span className="font-medium">Sections</span>
        <span className="flex items-center gap-xs text-on-surface-variant">
          {position}/{sectionOrder.length}
          <Icon name="expand_more" className="text-[20px]" aria-hidden />
        </span>
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-label="Consultation sections">
          <button
            type="button"
            aria-label="Close sections"
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative z-10 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-md py-md">
              <h2 className="text-headline-sm text-on-surface">Sections</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
              >
                <Icon name="close" />
              </button>
            </div>
            <ul className="space-y-xs px-md py-md">
              {sectionOrder.map((i, idx) => {
                const st = STATUS_ICON[sectionStatus[idx] ?? "empty"];
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => pickSection(i)}
                      className={cn(
                        "flex min-h-[44px] w-full items-center gap-sm rounded-lg px-sm py-sm text-left text-label-md transition-colors",
                        openSection === i ? "bg-primary/10 font-medium text-on-surface" : "text-on-surface-variant hover:bg-surface-container-low",
                      )}
                    >
                      {renderIndicator ? renderIndicator(i, "text-[18px]") : (
                        <Icon name={st.icon} className={cn("text-[18px]", st.cls)} aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 whitespace-normal">
                        {idx + 1}. {sections[i]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
//JJQR - END
