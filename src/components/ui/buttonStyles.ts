import { cn } from "@/lib/cn";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container",
  secondary: "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90",
};
export function buttonStyles(variant: ButtonVariant = "primary", className?: string) {
  return cn("inline-flex min-h-9 items-center justify-center gap-sm rounded-[6px] px-md py-sm text-[14px] font-medium" /* //JJQR - AI (Nov 22, 2026) desktop standard: 36px, 6px radius, 14px */,
    "transition-[transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
    "motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
    VARIANTS[variant], className);
}
