import { cn } from "@/lib/cn";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
  secondary: "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90 shadow-sm",
};
export function buttonStyles(variant: ButtonVariant = "primary", className?: string) {
  return cn("inline-flex min-h-11 items-center justify-center gap-sm rounded-lg px-lg py-md text-label-md font-medium",
    "transition-[transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
    "active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
    VARIANTS[variant], className);
}
