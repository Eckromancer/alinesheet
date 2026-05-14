import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useSession, setSession } from "@/lib/session";
import { fetchAll, type ReviewItem } from "@/lib/reviews";
import { downloadFile, rowsForExport, toCSV, formatPrice } from "@/lib/exporting";
import { generateWorksheetPDF } from "@/lib/pdf";
import { CheckCircle2, Download, Mail, Loader2, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";

const MADISON_EMAIL = "madison.withers@saks.com";

export default function Confirmation() {
  const session = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!session) return navigate("/");
    (async () => {
      try { setItems(await fetchAll(session.reviewer, session.store)); }
      finally { setLoading(false); }
    })();
  }, [session, navigate]);

  const stats = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, units: 0 };
    items.forEach((it) => {
      const d = it.review?.decision_status;
      if (d === "green") c.green++;
      else if (d === "yellow") c.yellow++;
      else if (d === "red") c.red++;
      c.units += it.review?.requested_bulk_units ?? 0;
    });
    return c;
  }, [items]);

  const submittedAt = useMemo(() => {
    const ts = items.map((i) => i.review?.submitted_at).filter(Boolean) as string[];
    if (!ts.length) return null;
    return new Date(ts.sort().reverse()[0]).toLocaleString();
  }, [items]);

  const exportCSV = () => {
    if (!session) return;
    const rows = rowsForExport(items, session.reviewer, session.store);
    downloadFile(toCSV(rows), `akris-review-${session.store.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0,10)}.csv`);
  };
  const exportJSON = () => {
    if (!session) return;
    const payload = {
      reviewer: session.reviewer,
      store: session.store,
      submitted_at: submittedAt,
      counts: stats,
      recipient: MADISON_EMAIL,
      items: rowsForExport(items, session.reviewer, session.store),
    };
    downloadFile(JSON.stringify(payload, null, 2),
      `akris-review-${session.store.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0,10)}.json`,
      "application/json");
  };

  const exportPDF = async () => {
    if (!session) return;
    setPdfBusy(true);
    setPdfProgress({ done: 0, total: items.length });
    try {
      await generateWorksheetPDF(items, session.reviewer, session.store, (done, total) =>
        setPdfProgress({ done, total })
      );
      toast.success("PDF worksheet generated");
    } catch (e: any) {
      toast.error(e?.message ?? "PDF generation failed");
    } finally {
      setPdfBusy(false);
    }
  };

  const newReview = () => {
    setSession(null);
    navigate("/");
  };

  if (loading) {
    return (
      <AppShell subtitle="Submitted">
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Submission Complete">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-decision-green-soft text-decision-green">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-medium">Submission sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Submission sent to Madison for processing and allocation.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left shadow-card">
          <Row label="Reviewer" value={session?.reviewer ?? "—"} />
          <Row label="Store" value={session?.store ?? "—"} />
          <Row label="Submitted" value={submittedAt ?? "—"} />
          <Row label="Recipient" value={MADISON_EMAIL} />
          <hr className="my-3 border-border" />
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Green" value={stats.green} tone="text-decision-green" />
            <Stat label="Yellow" value={stats.yellow} tone="text-foreground" />
            <Stat label="Red" value={stats.red} tone="text-decision-red" />
            <Stat label="Units" value={stats.units} />
          </div>
        </div>

        <Button onClick={exportPDF} disabled={pdfBusy} size="lg" className="mt-5 h-12 w-full">
          {pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          {pdfBusy
            ? `Building PDF… ${pdfProgress.done}/${pdfProgress.total}`
            : "Download Full Worksheet PDF"}
        </Button>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={exportCSV} variant="outline" size="lg" className="h-12">
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
          <Button onClick={exportJSON} variant="outline" size="lg" className="h-12">
            <FileJson className="mr-2 h-4 w-4" /> Download JSON
          </Button>
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/50 p-3 text-left text-xs text-muted-foreground">
          <Mail className="mr-1 inline h-3.5 w-3.5" />
          Auto-delivery to <span className="font-medium text-foreground">{MADISON_EMAIL}</span> can be wired via webhook or email integration.
          The export above is the spreadsheet-ready payload.
        </div>

        <Button onClick={newReview} className="mt-6 w-full" size="lg" variant="ghost">
          Start a new session
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
function Stat({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={`font-display text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
