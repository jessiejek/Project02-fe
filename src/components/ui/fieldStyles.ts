import { cn } from "@/lib/cn";

/** One text-field look for every form: 44px target, readable placeholder, teal focus ring. */
export function inputStyles(className?: string) {
  return cn(
    "min-h-[38px] w-full rounded-[6px] border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-md text-on-surface",
    "placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
    "disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant",
    className,
  );
}

/** Persistent field label: on-surface for contrast, never a faint grey. */
export const labelStyles = "block text-[12px] font-semibold tracking-[0.02em] text-on-surface-variant";

/** Helper/hint copy under a field. */
export const hintStyles = "text-label-md text-on-surface-variant";
