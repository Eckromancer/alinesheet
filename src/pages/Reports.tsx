import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { downloadFile, toCSV } from "@/lib/exporting";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { seasonSlug, sortSeasons } from "@/lib/seasons";

type Review = Tables<"reviews">;
type Product = Tables<"products">;

export default function Reports() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("reviews").select("*").eq("submission_status", "submitted"),
        supabase.from("products").select("*"),
      ]);
      const reviewRows = r ?? [];
      const productRows = p ?? [];
      const availableSeasons = sortSeasons(productRows.map((product) => product.season ?? ""));
      const latestSeason = availableSeasons[0] ?? "";
      const activeProducts = productRows.filter((product) => product.season === latestSeason);
      const activeIds = new Set(activeProducts.map((product) => product.id));
      setAllReviews(reviewRows);
      setAllProducts(productRows);
      setSeasons(availableSeasons);
      setSelectedSeason(latestSeason);
      setProducts(activeProducts);
      setReviews(reviewRows.filter((review) => activeIds.has(review.product_id)));
    })();
  }, []);

  const exportSubmissions = () => {
    const pmap = new Map(products.map((p) => [p.id, p]));
    const rows = reviews.map((r) => {
      const p = pmap.get(r.product_id);
      return {
        store: r.store,
        season: selectedSeason,
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
    downloadFile(toCSV(rows), `buyer-submissions-${seasonSlug(selectedSeason)}-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Submissions export ready" });
  };

  const exportPriority = () => {
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
          season: selectedSeason,
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
    downloadFile(toCSV(rows), `buyer-priority-${seasonSlug(selectedSeason)}-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Priority report ready" });
  };

  const cards = [
    {
      eyebrow: "01",
      title: "Submissions Export",
      blurb:
        "Every submitted line, by store and DSA, with sizes, units and client-backed notes.",
      cta: exportSubmissions,
    },
    {
      eyebrow: "02",
      title: "Buyer Priority Report",
      blurb:
        "One row per style with G/Y/R counts, requested units, client-backed flags and weighted Buyer Priority Score.",
      cta: exportPriority,
    },
  ];

  return (
    <ManagerLayout>
      <header className="border-b border-[hsl(var(--hairline))] pb-10 pt-2">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground bracket-num">
          Reports
        </p>
        <h1 className="mt-4 font-display text-[48px] font-normal leading-[0.95] tracking-tight sm:text-[64px]">
          Take the buy <span className="display-italic">out of the room.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Buyer-ready exports drawn from live DSA submissions.
        </p>
        <Select
          value={selectedSeason}
          onValueChange={(season) => {
            const activeProducts = allProducts.filter((product) => product.season === season);
            const activeIds = new Set(activeProducts.map((product) => product.id));
            setSelectedSeason(season);
            setProducts(activeProducts);
            setReviews(allReviews.filter((review) => activeIds.has(review.product_id)));
          }}
        >
          <SelectTrigger className="mt-6 h-10 w-48 rounded-none border-foreground bg-background text-xs uppercase tracking-[0.16em]">
            <SelectValue placeholder="Select season" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((season) => <SelectItem key={season} value={season}>{season}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <section className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.eyebrow} className="border-t border-foreground pt-5">
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num">
              {c.eyebrow}
            </span>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
              {c.title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {c.blurb}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-5 rounded-none border-foreground text-[11px] uppercase tracking-[0.22em]"
              onClick={c.cta}
            >
              <Download className="mr-2 h-3.5 w-3.5" /> Download CSV
            </Button>
          </div>
        ))}
      </section>
    </ManagerLayout>
  );
}
