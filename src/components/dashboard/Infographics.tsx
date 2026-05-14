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

/* -------------------------------------------------------------------------- */
/* 1. Hero stat — oversized typographic ratio                                  */
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
  return (
    <div className="flex flex-col">
      <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground bracket-num">
        {label}
      </p>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-[96px] font-normal leading-[0.85] tracking-tight sm:text-[128px]">
          {numerator}
        </span>
        <span className="font-display text-3xl text-muted-foreground tabular-nums">
          / {denominator}
        </span>
      </div>
      {caption && (
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {caption}
        </p>
      )}
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {pct}% · ratio
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Assortment Matrix                                                       */
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
  const sorted = [...aggs].sort((a, b) => {
    const ra = order.indexOf(a.recommendation);
    const rb = order.indexOf(b.recommendation);
    if (ra !== rb) return ra - rb;
    return b.units - a.units;
  });

  const counts = order.map((r) => ({
    rec: r,
    n: aggs.filter((a) => a.recommendation === r).length,
  }));

  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))" }}
      >
        {sorted.map((a) => {
          const intensity = 0.35 + (a.units / maxUnits) * 0.65;
          return (
            <div
              key={a.product.id}
              className="group relative aspect-square cursor-default transition-transform hover:scale-110 hover:z-10"
              style={{
                backgroundColor: recColor(a.recommendation),
                opacity: intensity,
              }}
              title={`${a.product.style_number} · ${a.recommendation} · ${a.units}u`}
            >
              <div className="pointer-events-none absolute -top-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap border border-foreground bg-background px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground shadow-soft group-hover:block">
                {a.product.style_number} · {a.units}u
              </div>
            </div>
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
/* 3. Door Heatmap                                                            */
/* -------------------------------------------------------------------------- */
export interface DoorRow {
  store: string;
  tier: "flagship" | "premium" | "core" | "small";
  green: number;
  yellow: number;
  red: number;
  units: number;
}

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
      {rows.map((r) => {
        const total = Math.max(r.green + r.yellow + r.red, 1);
        const depthPct = (r.units / maxUnits) * 100;
        return (
          <div
            key={r.store}
            className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 py-4 sm:grid-cols-[14rem_1fr_auto]"
          >
            <div className="flex flex-col">
              <p className="truncate text-sm">{r.store}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {tierLabel[r.tier]}
              </p>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <div className="flex h-2 w-full overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${(r.green / total) * 100}%`,
                    backgroundColor: "hsl(var(--decision-green))",
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(r.yellow / total) * 100}%`,
                    backgroundColor: "hsl(var(--decision-yellow))",
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(r.red / total) * 100}%`,
                    backgroundColor: "hsl(var(--decision-red))",
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(0, 100 - ((r.green + r.yellow + r.red) / total) * 100)}%`,
                    backgroundColor: "hsl(var(--muted))",
                  }}
                />
              </div>
              <div className="h-px w-full bg-[hsl(var(--hairline))]">
                <div
                  className="h-px bg-foreground"
                  style={{ width: `${depthPct}%` }}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 self-start sm:self-center">
              <span className="font-display text-xl tabular-nums leading-none">
                {r.units}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                u
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Category Ratios                                                         */
/* -------------------------------------------------------------------------- */
export interface CategoryRow {
  category: string;
  styles: number;
  units: number;
  greenStyles: number;
}

export function CategoryRatios({ rows }: { rows: CategoryRow[] }) {
  const maxUnits = Math.max(...rows.map((r) => r.units), 1);
  return (
    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r, i) => {
        const pct = r.styles > 0 ? Math.round((r.greenStyles / r.styles) * 100) : 0;
        const depthPct = (r.units / maxUnits) * 100;
        return (
          <div key={r.category} className="border-t border-foreground pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {pct}% green
              </span>
            </div>
            <h4 className="mt-2 font-display text-2xl capitalize leading-tight tracking-tight">
              {r.category}
            </h4>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-5xl tabular-nums leading-none">
                {r.greenStyles}
              </span>
              <span className="font-display text-2xl text-muted-foreground tabular-nums">
                / {r.styles}
              </span>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {r.units}u
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-[hsl(var(--hairline))]">
              <div
                className="h-px bg-foreground"
                style={{ width: `${depthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const _cn = cn;
