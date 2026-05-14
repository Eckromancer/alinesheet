import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { downloadFile, toCSV } from "@/lib/exporting";
import { toast } from "@/hooks/use-toast";

type Review = Tables<"reviews">;
type Product = Tables<"products">;

export default function Reports() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("reviews").select("*").eq("submission_status", "submitted"),
        supabase.from("products").select("*"),
      ]);
      setReviews(r ?? []);
      setProducts(p ?? []);
    })();
  }, []);

  const exportSubmissions = () => {
    const pmap = new Map(products.map((p) => [p.id, p]));
    const rows = reviews.map((r) => {
      const p = pmap.get(r.product_id);
      return {
        store: r.store,
        reviewer: r.reviewer,
        style_number: p?.style_number ?? "",
        description: p?.long_style_desc ?? "",
        color: p?.color ?? "",
        retail_price: p?.retail_price ?? "",
        decision: r.decision_status ?? "",
        requested_bulk_units: r.requested_bulk_units ?? 0,
        sizes: r.selected_sizes?.join(" ") ?? "",
        notes: r.notes ?? "",
        client_backed_notes: r.special_order_notes ?? "",
        processed: r.processed ? "yes" : "no",
        submitted_at: r.submitted_at ?? "",
      };
    });
    downloadFile(toCSV(rows), `buyer-submissions-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Submissions export ready" });
  };

  const exportPriority = () => {
    const pmap = new Map(products.map((p) => [p.id, p]));
    const agg = new Map<
      string,
      { green: number; yellow: number; red: number; units: number; client: number }
    >();
    reviews.forEach((r) => {
      const cur = agg.get(r.product_id) ?? { green: 0, yellow: 0, red: 0, units: 0, client: 0 };
      if (r.decision_status === "green") cur.green += 1;
      else if (r.decision_status === "yellow") cur.yellow += 1;
      else if (r.decision_status === "red") cur.red += 1;
      cur.units += r.requested_bulk_units ?? 0;
      if (r.special_order_notes && r.special_order_notes.trim()) cur.client += 1;
      agg.set(r.product_id, cur);
    });
    const rows = products
      .map((p) => {
        const a = agg.get(p.id) ?? { green: 0, yellow: 0, red: 0, units: 0, client: 0 };
        const score = a.green * 3 + a.yellow - a.red + a.units * 0.5 + a.client * 2;
        return {
          style_number: p.style_number,
          description: p.long_style_desc,
          color: p.color,
          retail_price: p.retail_price ?? "",
          green: a.green,
          yellow: a.yellow,
          red: a.red,
          requested_units: a.units,
          client_backed: a.client,
          buyer_priority_score: Math.round(score * 10) / 10,
        };
      })
      .sort((a, b) => b.buyer_priority_score - a.buyer_priority_score);
    downloadFile(toCSV(rows), `buyer-priority-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Priority report ready" });
  };

  return (
    <ManagerLayout>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buyer-ready exports drawn from live DSA submissions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Submissions export
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Every submitted line, by store and DSA, with sizes, units and client-backed notes.
          </p>
          <Button size="sm" variant="outline" onClick={exportSubmissions}>
            <Download className="mr-1 h-4 w-4" /> Download CSV
          </Button>
        </Card>

        <Card className="p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Buyer priority report
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            One row per style with G/Y/R counts, requested units, client-backed and Buyer Priority Score.
          </p>
          <Button size="sm" variant="outline" onClick={exportPriority}>
            <Download className="mr-1 h-4 w-4" /> Download CSV
          </Button>
        </Card>
      </div>
    </ManagerLayout>
  );
}
