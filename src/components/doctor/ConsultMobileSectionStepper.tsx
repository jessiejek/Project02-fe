"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

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
}

/** Compact horizontal progress for viewports below lg (F-011). */
export function ConsultMobileSectionStepper({
  sections,
  sectionOrder,
  sectionStatus,
  openSection,
  onSelect,
}: ConsultMobileSectionStepperProps) {
  return (
    <div className="lg:hidden">
      <div className="flex gap-sm overflow-x-auto pb-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sectionOrder.map((i, idx) => {
          const st = STATUS_ICON[sectionStatus[idx] ?? "empty"];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "flex min-h-[44px] shrink-0 items-center gap-xs rounded-lg border px-sm py-xs text-label-sm",
                openSection === i ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
              )}
            >
              <Icon name={st.icon} className={cn("text-[16px]", st.cls)} aria-hidden />
              <span className="max-w-[8rem] truncate">{sections[i]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
//JJQR - END
