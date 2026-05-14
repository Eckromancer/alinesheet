import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { downloadFile, toCSV } from "@/lib/exporting";

type Review = Tables<"reviews">;
type Product = Tables<"products">;

interface Row {
  review: Review;
  product: Product | undefined;
}

const STATUS_COLORS: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  red: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export default function Manager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [storeFilter, setStoreFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [hideProcessed, setHideProcessed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // auth handled by ManagerLayout
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: reviews, error: rErr }, { data: products, error: pErr }] = await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .eq("submission_status", "submitted")
        .order("submitted_at", { ascending: false }),
      supabase.from("products").select("*"),
    ]);
    if (rErr || pErr) {
      toast({ title: "Failed to load submissions", variant: "destructive" });
      setLoading(false);
      return;
    }
    const pmap = new Map((products ?? []).map((p) => [p.id, p]));
    setRows((reviews ?? []).map((r) => ({ review: r, product: pmap.get(r.product_id) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stores = useMemo(
    () => Array.from(new Set(rows.map((r) => r.review.store))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ review, product }) => {
      if (storeFilter !== "__all__" && review.store !== storeFilter) return false;
      if (statusFilter !== "__all__" && review.decision_status !== statusFilter) return false;
      if (hideProcessed && review.processed) return false;
      if (q) {
        const hay = [
          product?.style_number,
          product?.long_style_desc,
          product?.color,
          review.reviewer,
          review.store,
          review.notes,
          review.special_order_notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, storeFilter, statusFilter, hideProcessed, search]);

  const setProcessed = async (id: string, value: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.review.id === id
          ? {
              ...r,
              review: {
                ...r.review,
                processed: value,
                processed_at: value ? new Date().toISOString() : null,
              },
            }
          : r
      )
    );
    const { error } = await supabase
      .from("reviews")
      .update({
        processed: value,
        processed_at: value ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      load();
    }
  };

  const exportCsv = () => {
    const out = filtered.map(({ review, product }) => ({
      store: review.store,
      dsa: review.reviewer,
      style_number: product?.style_number ?? "",
      description: product?.long_style_desc ?? "",
      color: product?.color ?? "",
      decision: review.decision_status ?? "",
      sizes: review.selected_sizes?.join(" ") ?? "",
      notes: review.notes ?? "",
      special_order_notes: review.special_order_notes ?? "",
      processed: review.processed ? "yes" : "no",
      submitted_at: review.submitted_at ?? "",
    }));
    downloadFile(toCSV(out), `submissions-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const counts = useMemo(() => {
    const total = filtered.length;
    const processed = filtered.filter((r) => r.review.processed).length;
    return { total, processed, pending: total - processed };
  }, [filtered]);

  return (
    <ManagerLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">All DSA Submissions</h1>
          <p className="text-xs text-muted-foreground">
            {counts.total} item{counts.total === 1 ? "" : "s"} · {counts.processed} processed ·{" "}
            {counts.pending} pending
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search style, color, DSA…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All stores</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All decisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All decisions</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="yellow">Yellow</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm">
        <Checkbox
          checked={hideProcessed}
          onCheckedChange={(v) => setHideProcessed(v === true)}
        />
        Hide processed
      </label>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Done</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>DSA</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Sizes</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Special Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No submissions match these filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(({ review, product }) => (
              <TableRow
                key={review.id}
                className={review.processed ? "opacity-50" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={review.processed}
                    onCheckedChange={(v) => setProcessed(review.id, v === true)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{review.store}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{review.reviewer}</TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{product?.style_number ?? "—"}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {product?.long_style_desc}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{product?.color ?? "—"}</TableCell>
                <TableCell>
                  {review.decision_status ? (
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[review.decision_status] ?? ""}
                    >
                      {review.decision_status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {review.selected_sizes?.length
                    ? review.selected_sizes.join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                  {review.notes || "—"}
                </TableCell>
                <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                  {review.special_order_notes || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ManagerLayout>
  );
}
