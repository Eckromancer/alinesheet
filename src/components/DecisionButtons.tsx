import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@/lib/reviews";

interface Props {
  value: DecisionStatus | null | undefined;
  onChange: (v: DecisionStatus) => void;
  disabled?: boolean;
}

const OPTIONS: { value: DecisionStatus; label: string; helper: string }[] = [
  { value: "green", label: "Green", helper: "Want in buy" },
  { value: "yellow", label: "Yellow", helper: "Nice to have" },
  { value: "red", label: "Red", helper: "Do not send" },
];

export default function DecisionButtons({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        const palette =
          o.value === "green"
            ? active
              ? "bg-decision-green text-decision-green-foreground border-decision-green shadow-soft"
              : "bg-decision-green-soft text-decision-green border-decision-green/30 hover:border-decision-green"
            : o.value === "yellow"
            ? active
              ? "bg-decision-yellow text-decision-yellow-foreground border-decision-yellow shadow-soft"
              : "bg-decision-yellow-soft text-foreground border-decision-yellow/40 hover:border-decision-yellow"
            : active
            ? "bg-decision-red text-decision-red-foreground border-decision-red shadow-soft"
            : "bg-decision-red-soft text-decision-red border-decision-red/30 hover:border-decision-red";
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "flex min-h-[68px] flex-col items-center justify-center rounded-xl border-2 px-3 py-2 text-center transition-all active:scale-[0.98] disabled:opacity-60",
              palette
            )}
          >
            <span className="font-display text-lg font-semibold leading-none">{o.label}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider opacity-80">{o.helper}</span>
          </button>
        );
      })}
    </div>
  );
}
