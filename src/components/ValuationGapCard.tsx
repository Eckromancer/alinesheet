import type { ValuationResult } from "@/utils/valuationEngine";
import type { BusinessType } from "@/utils/valuationEngine";

interface ValuationGapCardProps {
  title?: string;
  businessType: BusinessType | string;
  valuation: ValuationResult;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

export default function ValuationGapCard({ title, businessType, valuation }: ValuationGapCardProps) {
  const { estimatedValuationUSD, gapToThresholdUSD, multipleUsed, passesElitePrivateThreshold } = valuation;

  const ONE_BILLION = 1_000_000_000;
  const percentageOfTarget = Math.min((estimatedValuationUSD / ONE_BILLION) * 100, 100);

  // Parse the numeric multiple out of "12x ARR" for the ARR expansion hint
  const multipleNumeric = parseInt(multipleUsed, 10) || 12;

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-slate-100 max-w-2xl mx-auto my-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 px-2 py-1 bg-cyan-950 border border-cyan-800 rounded-md">
            {businessType.toString().replace(/_/g, " ")}
          </span>
          <h3 className="text-xl font-bold mt-2 text-white">{title ?? "Scraped Concept Analysis"}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Current Valuation Proxy</p>
          <p className="text-2xl font-black text-emerald-400 tracking-tight">{fmt(estimatedValuationUSD)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
          <span>$0 Baseline</span>
          <span className="text-amber-400 font-bold">{percentageOfTarget.toFixed(1)}% of Private Threshold</span>
          <span>$1.0B Target</span>
        </div>
        <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden p-[2px] border border-slate-700">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
            style={{ width: `${percentageOfTarget}%` }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800 text-sm">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs text-slate-500 block mb-1">Live Multiplier Applied</span>
          <span className="font-mono text-white font-semibold">{multipleUsed}</span>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs text-slate-500 block mb-1">Deficit Target Gap</span>
          <span className={`font-mono font-bold ${passesElitePrivateThreshold ? "text-cyan-400" : "text-amber-500"}`}>
            {passesElitePrivateThreshold ? "Goal Reached ✓" : fmt(gapToThresholdUSD)}
          </span>
        </div>
      </div>

      {/* ARR expansion hint */}
      {!passesElitePrivateThreshold && (
        <p className="text-xs text-slate-500 mt-4 text-center italic">
          Requires an additional {fmt(gapToThresholdUSD / multipleNumeric)} in ARR expansion to achieve top private enterprise tiers.
        </p>
      )}
    </div>
  );
}
