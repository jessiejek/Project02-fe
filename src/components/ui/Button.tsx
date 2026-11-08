"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

import { buttonStyles, type ButtonVariant } from "./buttonStyles";
export type { ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * The action behind this click is in flight. Disables the button, swaps the
   * cursor to a spinner (not the "not-allowed" slash — this isn't blocked, it's
   * working), and shows a small spin icon so a click always gets an immediate,
   * honest reaction instead of looking like nothing happened.
   */
  loading?: boolean;
}


/**
 * Single Button implementation for the whole app (per React-Conversion-Guide.md
 * §5) — primary/secondary/ghost/danger, replaces every per-screen button
 * markup from the Stitch export.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, disabled, loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          buttonStyles(variant),
          loading && "!cursor-wait",
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin motion-reduce:hidden"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
