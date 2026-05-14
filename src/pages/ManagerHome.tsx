import { Link } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { ArrowUpRight } from "lucide-react";

const cards = [
  {
    to: "/manager",
    eyebrow: "01",
    title: "Buyer Dashboard",
    blurb:
      "Door-weighted conviction, assortment matrix, category ratios and mixed-signal review across the season.",
    cta: "Open dashboard",
  },
  {
    to: "/manager/reports",
    eyebrow: "02",
    title: "Reports",
    blurb:
      "Buyer-ready exports drawn from live DSA submissions — submissions log and priority report.",
    cta: "Open reports",
  },
  {
    to: "/manager/governance",
    eyebrow: "03",
    title: "Governance",
    blurb:
      "Decision audit trail and oversight for the seasonal worksheet.",
    cta: "Open governance",
  },
  {
    to: "/",
    eyebrow: "04",
    title: "DSA Entry",
    blurb:
      "The store reviewer workflow used by DSAs to evaluate the season.",
    cta: "Open DSA portal",
  },
];

export default function ManagerHome() {
  return (
    <ManagerLayout>
      <header className="border-b border-[hsl(var(--hairline))] pb-10 pt-2">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground bracket-num">
          Home
        </p>
        <h1 className="mt-4 font-display text-[56px] font-normal leading-[0.95] tracking-tight sm:text-[72px]">
          Buying <span className="display-italic">Intelligence.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          A curated workspace for the buying office — door-weighted signal, qualitative
          forecasting and executive readouts beside the live DSA worksheet.
        </p>
      </header>

      <section className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group block border-t border-foreground pt-5"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num">
                {c.eyebrow}
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
              {c.title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {c.blurb}
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-foreground underline-offset-8 group-hover:underline">
              {c.cta} →
            </p>
          </Link>
        ))}
      </section>
    </ManagerLayout>
  );
}
