"use client";

//JJQR - AI (Oct 31, 2026)
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { getCurvePoints, type GrowthMeasure } from "@/lib/clinical/growth";

type SexProp = "male" | "female" | "Male" | "Female" | string;

export type GrowthPatientPoint = {
  ageMonths: number;
  weight?: number;
  height?: number;
  hc?: number;
};

type MeasureTab = "weight" | "height" | "hc";

const TAB_LABELS: { id: MeasureTab; label: string; measure: GrowthMeasure }[] = [
  { id: "weight", label: "Weight", measure: "weight" },
  { id: "height", label: "Length/Height", measure: "height" },
  { id: "hc", label: "Head circ.", measure: "hc" },
];

const W = 420;
const H = 220;
const PAD = { l: 44, r: 12, t: 16, b: 32 };

function normalizeSex(sex: SexProp): "male" | "female" {
  return String(sex).toLowerCase().startsWith("f") ? "female" : "male";
}

export function GrowthChart({
  sex,
  ageMonths,
  points = [],
}: {
  sex: SexProp;
  ageMonths: number;
  points?: GrowthPatientPoint[];
}) {
  const [tab, setTab] = useState<MeasureTab>("weight");
  const measure = TAB_LABELS.find((t) => t.id === tab)!.measure;
  const s = normalizeSex(sex);

  const curves = useMemo(() => getCurvePoints(s, measure, 60), [s, measure]);

  const plot = useMemo(() => {
    if (curves.length === 0) return null;
    const ages = curves.map((c) => c.ageMonths);
    const vals = curves.flatMap((c) => [c.p3, c.p97]);
    const patientVals = points
      .map((p) => (tab === "weight" ? p.weight : tab === "height" ? p.height : p.hc))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const minAge = 0;
    const maxAge = Math.max(60, ageMonths, ...points.map((p) => p.ageMonths));
    const minY = Math.min(...vals, ...patientVals) * 0.92;
    const maxY = Math.max(...vals, ...patientVals) * 1.08;
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = (mo: number) => PAD.l + ((mo - minAge) / (maxAge - minAge || 1)) * innerW;
    const y = (v: number) => PAD.t + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;

    const line = (key: "p3" | "p15" | "p50" | "p85" | "p97") =>
      curves
        .map((c, i) => `${i === 0 ? "M" : "L"} ${x(c.ageMonths).toFixed(1)} ${y(c[key]).toFixed(1)}`)
        .join(" ");

    const dots = points
      .map((p) => {
        const v = tab === "weight" ? p.weight : tab === "height" ? p.height : p.hc;
        if (v == null || !Number.isFinite(v)) return null;
        return { cx: x(p.ageMonths), cy: y(v) };
      })
      .filter(Boolean) as { cx: number; cy: number }[];

    return { line, dots, x, y, minAge, maxAge, minY, maxY, ages };
  }, [curves, points, tab, ageMonths]);

  if (!plot || curves.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant">Growth chart not available for this measure.</p>
    );
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
      <div className="mb-sm flex flex-wrap gap-xs">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-md py-xs text-label-sm",
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" role="img" aria-label="WHO growth percentiles">
        {[plot.minAge, plot.maxAge / 2, plot.maxAge].map((mo) => (
          <text
            key={mo}
            x={plot.x(mo)}
            y={H - 8}
            textAnchor="middle"
            className="fill-on-surface-variant text-[10px]"
          >
            {Math.round(mo)} mo
          </text>
        ))}
        {(["p3", "p15", "p50", "p85", "p97"] as const).map((k) => (
          <path
            key={k}
            d={plot.line(k)}
            fill="none"
            stroke={k === "p50" ? "currentColor" : "currentColor"}
            strokeOpacity={k === "p50" ? 0.85 : 0.35}
            strokeWidth={k === "p50" ? 1.5 : 0.75}
            className="text-primary"
          />
        ))}
        <text x={PAD.l + 4} y={PAD.t + 10} className="fill-primary text-[10px]">
          P50
        </text>
        {plot.dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={4} className="fill-amber-600 stroke-surface stroke-[1.5]" />
        ))}
      </svg>
      <p className="mt-xs text-label-sm text-on-surface-variant">
        Approx. WHO centiles (0–60 mo). Amber dots = patient measurements.
      </p>
    </div>
  );
}
//JJQR - END
