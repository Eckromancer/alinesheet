import ManagerLayout from "@/components/ManagerLayout";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Lock, FileSignature, Users } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Data integrity",
    body: "All DSA submissions are timestamped, locked after submit, and traceable to a named reviewer at a single door.",
  },
  {
    icon: Lock,
    title: "Access control",
    body: "Buyer Dashboard, Governance, and Reports are gated behind the Management Portal. DSAs only see their own door.",
  },
  {
    icon: FileSignature,
    title: "Decision audit trail",
    body: "Every Green / Yellow / Red selection, requested unit count, size grid, and client-backed note is preserved per row.",
  },
  {
    icon: Users,
    title: "Reviewer accountability",
    body: "Pilot testers and store DSAs are tagged distinctly so leadership can isolate live signal from rehearsal data.",
  },
];

export default function Governance() {
  return (
    <ManagerLayout>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Governance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controls protecting the integrity of the buying review worksheet.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <Card key={it.title} className="p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <it.icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {it.title}
              </h3>
            </div>
            <p className="text-sm leading-relaxed">{it.body}</p>
          </Card>
        ))}
      </div>
    </ManagerLayout>
  );
}
