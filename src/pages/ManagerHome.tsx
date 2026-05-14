import { Link } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { LayoutDashboard, ClipboardList, ArrowRight } from "lucide-react";

export default function ManagerHome() {
  return (
    <ManagerLayout>
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Home
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          Choose a dashboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Switch between the buyer-facing Management Portal and the DSA review experience.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/manager"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:shadow-card"
        >
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl tracking-tight">Manager Portal</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Executive summary, priority scoring, governance, and reports across all 24 stores.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-foreground">
            Open dashboard
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          to="/"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:shadow-card"
        >
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background">
            <ClipboardList className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl tracking-tight">DSA Portal</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the store reviewer workflow used by DSAs and pilot testers to evaluate the 103 items.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-foreground">
            Open DSA portal
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </ManagerLayout>
  );
}
