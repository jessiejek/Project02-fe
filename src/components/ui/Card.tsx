"use client";

import { type HTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

/** Generic elevated container — the "bento-card" pattern used across every dashboard. */
export function Card({ hoverable, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bento-card rounded-xl border border-outline-variant bg-surface-container-lowest p-lg",
        hoverable && "cursor-pointer hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  eyebrow?: string;
  onClick?: () => void;
  href?: string;
}

/** Icon + number + label stat card, optionally clickable (dashboards across all 4 roles use this). */
export function StatCard({ icon, label, value, eyebrow, onClick, href }: StatCardProps) {
  const content = (
    <>
      <div className="mb-md flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon name={icon} />
        </div>
        {eyebrow && (
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant/60">
            {eyebrow}
          </span>
        )}
      </div>
      <p className="text-headline-lg text-on-surface">{value}</p>
      <p className="text-label-md text-on-surface-variant">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card hoverable>{content}</Card>
      </Link>
    );
  }

  return (
    <Card hoverable={Boolean(onClick)} onClick={onClick}>
      {content}
    </Card>
  );
}
