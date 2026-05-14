import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export type Decision = "green" | "yellow" | "red";
export type Recommendation =
  | "Buy with confidence"
  | "Increase depth"
  | "Test buy"
  | "Flag for review"
  | "Pass";

export interface AggLite {
  product: Product;
  green: number;
  yellow: number;
  red: number;
  units: number;
  total: number;
  recommendation: Recommendation;
  category: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/* 1. Hero stat — oversized typographic ratio + radial dial                    */
/* -------------------------------------------------------------------------- */
export function HeroRatio({
  numerator,
  denominator,
  label,
  caption,
}: {
  numerator: number;
  denominator: number;
  label: string;
  caption?: string;
}) {
  const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const radius = 92;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
      <div className="flex flex-col">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground bracket-num">
          {label}
        </p>
        <div className="mt-4 flex items-baseline gap-3">
          <motion.span
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease }}
            className="font-display text-[112px] font-medium leading-[0.82] tracking-[-0.04em] sm:text-[160px]"
          >
            {numerator}
          </motion.span>
          <span className="font-display text-3xl text-muted-foreground tabular-nums">
            / {denominator}
          </span>
        </div>
        {caption && (
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            {caption}
          </p>
        )}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {pct}% conviction ratio
        </p>
      </div>

      {/* Radial dial */}
      <div className="relative shrink-0 self-start sm:self-end">
        <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="hsl(var(--hairline))"
            strokeWidth="1"
          />
          <motion.circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth="2.5"
            strokeLinecap="butt"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.4, ease, delay: 0.2 }}
          />
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i / 60) * 2 * Math.PI;
            const inner = radius + 8;
            const outer = radius + (i % 5 === 0 ? 16 : 12);
            const x1 = 110 + Math.cos(angle) * inner;
            const y1 = 110 + Math.sin(angle) * inner;
            const x2 = 110 + Math.cos(angle) * outer;
            const y2 = 110 + Math.sin(angle) * outer;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--hairline))"
                strokeWidth={i % 5 === 0 ? 1 : 0.5}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-5xl tabular-nums leading-none">
            {pct}
            <span className="text-2xl text-muted-foreground">%</span>
          </span>
          <span className="mt-2 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
            Conviction
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Conviction Ribbon — bold bar + animated counters                         */
/* -------------------------------------------------------------------------- */
export function ConvictionRibbon({
  green,
  yellow,
  red,
}: {
  green: number;
  yellow: number;
  red: number;
}) {
  const total = Math.max(green + yellow + red, 1);
  const items = [
    { key: "g", label: "Conviction", n: green, color: "hsl(var(--decision-green))" },
    { key: "y", label: "Consideration", n: yellow, color: "hsl(var(--decision-yellow))" },
    { key: "r", label: "Pass", n: red, color: "hsl(var(--decision-red))" },
  ];

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-[1px]">
        {items.map((it, i) => (
          <motion.div
            key={it.key}
            initial={{ width: 0 }}
            animate={{ width: `${(it.n / total) * 100}%` }}
            transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.12 }}
            style={{ backgroundColor: it.color }}
            className="h-full"
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-6">
        {items.map((it, i) => (
          <motion.div
            key={it.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.4 + i * 0.1 }}
            className="border-t border-foreground pt-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: it.color }}
              />
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {it.label}
              </p>
            </div>
            <p className="mt-3 font-display text-[56px] font-medium leading-none tracking-[-0.03em] tabular-nums">
              {it.n}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {Math.round((it.n / total) * 100)}% · share
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Assortment Matrix — denser grid, animated reveal                         */
/* -------------------------------------------------------------------------- */
function recColor(r: Recommendation): string {
  switch (r) {
    case "Buy with confidence":
    case "Increase depth":
      return "hsl(var(--decision-green))";
    case "Test buy":
      return "hsl(var(--decision-yellow))";
    case "Pass":
      return "hsl(var(--decision-red))";
    default:
      return "hsl(var(--editorial-clay))";
  }
}

export function AssortmentMatrix({ aggs }: { aggs: AggLite[] }) {
  const maxUnits = Math.max(...aggs.map((a) => a.units), 1);
  const order: Recommendation[] = [
    "Increase depth",
    "Buy with confidence",
    "Test buy",
    "Flag for review",
    "Pass",
  ];
  const sorted = useMemo(
    () =>
      [...aggs].sort((a, b) => {
        const ra = order.indexOf(a.recommendation);
        const rb = order.indexOf(b.recommendation);
        if (ra !== rb) return ra - rb;
        return b.units - a.units;
      }),
    [aggs]
  );
  const counts = order.map((r) => ({
    rec: r,
    n: aggs.filter((a) => a.recommendation === r).length,
  }));

  return (
    <div>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))" }}
      >
        {sorted.map((a, i) => {
          const intensity = 0.35 + (a.units / maxUnits) * 0.65;
          return (
            <motion.div
              key={a.product.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: intensity, scale: 1 }}
              transition={{ duration: 0.4, ease, delay: Math.min(i * 0.004, 0.6) }}
              whileHover={{ scale: 1.4, opacity: 1, zIndex: 10 }}
              className="group relative aspect-square cursor-default"
              style={{ backgroundColor: recColor(a.recommendation) }}
              title={`${a.product.style_number} · ${a.recommendation} · ${a.units}u`}
            >
              <div className="pointer-events-none absolute -top-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap border border-foreground bg-background px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground shadow-soft group-hover:block">
                {a.product.style_number} · {a.units}u
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        {counts.map((c) => (
          <div key={c.rec} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5"
              style={{ backgroundColor: recColor(c.rec) }}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {c.rec}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-foreground">
              {c.n}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          opacity = depth
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Door Heatmap — tier swatch + animated bars + numeric depth               */
/* -------------------------------------------------------------------------- */
export interface DoorRow {
  store: string;
  tier: "flagship" | "premium" | "core" | "small";
  green: number;
  yellow: number;
  red: number;
  units: number;
}

const TIER_COLORS: Record<DoorRow["tier"], string> = {
  flagship: "hsl(var(--editorial-terracotta))",
  premium: "hsl(var(--editorial-ink))",
  core: "hsl(var(--editorial-clay))",
  small: "hsl(var(--editorial-stone))",
};

export function DoorHeatmap({ rows }: { rows: DoorRow[] }) {
  const maxUnits = Math.max(...rows.map((r) => r.units), 1);
  const tierLabel: Record<DoorRow["tier"], string> = {
    flagship: "Flagship",
    premium: "Premium",
    core: "Core",
    small: "Small",
  };
  return (
    <div className="divide-y divide-[hsl(var(--hairline))] border-y border-[hsl(var(--hairline))]">
      {rows.map((r, i) => {
        const total = Math.max(r.green + r.yellow + r.red, 1);
        const depthPct = (r.units / maxUnits) * 100;
        return (
          <motion.div
            key={r.store}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease, delay: Math.min(i * 0.025, 0.5) }}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-2 py-5 sm:grid-cols-[auto_15rem_1fr_auto]"
          >
            <span
              className="h-8 w-[3px] self-center"
              style={{ backgroundColor: TIER_COLORS[r.tier] }}
              aria-hidden
            />
            <div className="flex flex-col">
              <p className="truncate text-sm">{r.store}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {tierLabel[r.tier]}
              </p>
            </div>
            <div className="col-span-3 flex flex-col gap-2 sm:col-span-1">
              <div className="flex h-2.5 w-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.green / total) * 100}%` }}
                  transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.02 }}
                  className="h-full"
                  style={{ backgroundColor: "hsl(var(--decision-green))" }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.yellow / total) * 100}%` }}
                  transition={{ duration: 0.7, ease, delay: 0.25 + i * 0.02 }}
                  className="h-full"
                  style={{ backgroundColor: "hsl(var(--decision-yellow))" }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.red / total) * 100}%` }}
                  transition={{ duration: 0.7, ease, delay: 0.35 + i * 0.02 }}
                  className="h-full"
                  style={{ backgroundColor: "hsl(var(--decision-red))" }}
                />
              </div>
              <div className="relative h-px w-full bg-[hsl(var(--hairline))]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${depthPct}%` }}
                  transition={{ duration: 0.9, ease, delay: 0.4 + i * 0.02 }}
                  className="absolute inset-y-[-1px] bg-foreground"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5 self-center">
              <span className="font-display text-3xl font-medium tabular-nums leading-none tracking-tight">
                {r.units}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                u
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Category Ratios — donut + huge numerals                                  */
/* -------------------------------------------------------------------------- */
export interface CategoryRow {
  category: string;
  styles: number;
  units: number;
  greenStyles: number;
}

function Donut({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--hairline))"
        strokeWidth="3"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--decision-green))"
        strokeWidth="3"
        strokeLinecap="butt"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (pct / 100) * c }}
        transition={{ duration: 1.1, ease }}
      />
    </svg>
  );
}

export function CategoryRatios({ rows }: { rows: CategoryRow[] }) {
  const maxUnits = Math.max(...rows.map((r) => r.units), 1);
  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r, i) => {
        const pct = r.styles > 0 ? Math.round((r.greenStyles / r.styles) * 100) : 0;
        const depthPct = (r.units / maxUnits) * 100;
        return (
          <motion.div
            key={r.category}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: i * 0.08 }}
            className="border-t border-foreground pt-5"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {pct}% green
              </span>
            </div>
            <h4 className="mt-2 font-display text-2xl font-medium capitalize leading-tight tracking-tight">
              {r.category}
            </h4>
            <div className="mt-5 flex items-center gap-5">
              <div className="relative shrink-0">
                <Donut pct={pct} />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-base tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[44px] font-medium leading-none tracking-[-0.03em] tabular-nums">
                    {r.greenStyles}
                  </span>
                  <span className="font-display text-xl text-muted-foreground tabular-nums">
                    / {r.styles}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {r.units} units
                </p>
              </div>
            </div>
            <div className="relative mt-5 h-px w-full bg-[hsl(var(--hairline))]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${depthPct}%` }}
                transition={{ duration: 1, ease, delay: 0.2 + i * 0.05 }}
                className="absolute inset-y-[-1px] bg-foreground"
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export const _cn = cn;
