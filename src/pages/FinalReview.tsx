import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSession } from "@/lib/session";
import { fetchAll, submitAll, type ReviewItem } from "@/lib/reviews";
import { formatPrice } from "@/lib/exporting";
import { Loader2, AlertTriangle, ArrowLeft, ImageOff } from "lucide-react";
import { toast } from "sonner";

type Bucket = "all" | "green" | "yellow" | "red" | "incomplete";

function validate(item: ReviewItem) {
  const r = item.review;
  if (!r?.decision_status) return "Missing decision";
  if (r.decision_status === "green" || r.decision_status === "yellow") {
    if (!Array.isArray(r.selected_sizes) || r.selected_sizes.length === 0) return "Missing sizes";
    if (r.requested_bulk_units == null) return "Missing requested units";
  }
  return null;
}

export default function FinalReview() {
  const session = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Bucket>("all");

  useEffect(() => {
    if (!session) return navigate("/");
    (async () => {
      try {
        setItems(await fetchAll(session.reviewer, session.store));
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, navigate]);

  const counts = useMemo(() => {
    const c = { all: items.length, green: 0, yellow: 0, red: 0, incomplete: 0, units: 0 };
    items.forEach((it) => {
      const d = it.review?.decision_status;
      if (d === "green") c.green++;
      else if (d === "yellow") c.yellow++;
      else if (d === "red") c.red++;
      if (validate(it)) c.incomplete++;
      c.units += (it.review?.selected_sizes?.length ?? 0);
    });
    return c;
  }, [items]);

  const errors = useMemo(() => items.map((it, i) => ({ i, item: it, error: validate(it) })).filter((e) => e.error), [items]);

  const filtered = useMemo(() => {
    return items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => {
        if (tab === "all") return true;
        if (tab === "incomplete") return !!validate(item);
        return item.review?.decision_status === tab;
      });
  }, [items, tab]);

  const submit = async () => {
    if (!session) return;
    if (errors.length) {
      toast.error(`${errors.length} item(s) need attention before submitting.`);
      setTab("incomplete");
      return;
    }
    setSubmitting(true);
    try {
      await submitAll(session.reviewer, session.store);
      navigate("/confirmation");
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell subtitle="Final Review">
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      subtitle={`Final · ${session?.reviewer}`}
      right={
        <Button variant="ghost" size="sm" onClick={() => navigate("/review")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      }
    >
      <div className="mb-5">
        <h1 className="font-display text-3xl font-medium">Final Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm selections before sending to the buying team.</p>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Green" value={counts.green} tone="green" />
        <SummaryStat label="Yellow" value={counts.yellow} tone="yellow" />
        <SummaryStat label="Red" value={counts.red} tone="red" />
        <SummaryStat label="Total Sizes" value={counts.units} />
      </div>

      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-decision-red/40 bg-decision-red-soft p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-decision-red">
            <AlertTriangle className="h-4 w-4" /> {errors.length} item(s) incomplete
          </div>
          <div className="flex flex-wrap gap-2">
            {errors.slice(0, 8).map(({ i, item, error }) => (
              <button
                key={item.product.id}
                onClick={() => navigate(`/review?i=${i}`)}
                className="rounded-full border border-decision-red/40 bg-card px-3 py-1 text-xs hover:bg-decision-red/10"
              >
                {item.product.style_number} — {error}
              </button>
            ))}
            {errors.length > 8 && <span className="text-xs text-muted-foreground">+{errors.length - 8} more</span>}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All <span className="ml-1 text-muted-foreground">{counts.all}</span></TabsTrigger>
          <TabsTrigger value="green">Green <span className="ml-1 text-muted-foreground">{counts.green}</span></TabsTrigger>
          <TabsTrigger value="yellow">Yellow <span className="ml-1 text-muted-foreground">{counts.yellow}</span></TabsTrigger>
          <TabsTrigger value="red">Red <span className="ml-1 text-muted-foreground">{counts.red}</span></TabsTrigger>
          <TabsTrigger value="incomplete">Issues <span className="ml-1 text-muted-foreground">{counts.incomplete}</span></TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.map(({ item, i }) => (
            <RowCard key={item.product.id} item={item} onClick={() => navigate(`/review?i=${i}`)} error={validate(item)} />
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No items.</p>}
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Button variant="outline" size="lg" onClick={() => navigate("/review")} className="flex-1">
            Keep Editing
          </Button>
          <Button size="lg" onClick={submit} disabled={submitting || errors.length > 0} className="flex-1">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Finalize & Submit
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "green" | "yellow" | "red" }) {
  const ring =
    tone === "green" ? "border-decision-green/40 bg-decision-green-soft" :
    tone === "yellow" ? "border-decision-yellow/50 bg-decision-yellow-soft" :
    tone === "red" ? "border-decision-red/40 bg-decision-red-soft" :
    "border-border bg-secondary";
  return (
    <div className={`rounded-xl border p-3 ${ring}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function RowCard({ item, onClick, error }: { item: ReviewItem; onClick: () => void; error: string | null }) {
  const d = item.review?.decision_status;
  const dot =
    d === "green" ? "bg-decision-green" :
    d === "yellow" ? "bg-decision-yellow" :
    d === "red" ? "bg-decision-red" :
    "bg-muted-foreground/40";
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:shadow-soft"
    >
      <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {item.product.image_url ? (
          <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/60"><ImageOff className="h-4 w-4" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{item.product.style_number}</span>
        </div>
        <div className="truncate font-display text-base">{item.product.long_style_desc}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.product.color}</span>
          <span>·</span>
          <span>{formatPrice(item.product.retail_price)}</span>
          {item.review?.selected_sizes && item.review.selected_sizes.length > 0 && (
            <>
              <span>·</span>
              <span>Sizes {item.review.selected_sizes.join(", ")}</span>
            </>
          )}
          {item.review?.requested_bulk_units != null && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">Units {item.review.requested_bulk_units}</span>
            </>
          )}
        </div>
        {error && <div className="mt-1 text-xs text-decision-red">{error}</div>}
      </div>
    </button>
  );
}
