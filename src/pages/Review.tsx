import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/lib/session";
import { fetchAll, upsertReview, type ReviewItem, type DecisionStatus } from "@/lib/reviews";
import { formatPrice } from "@/lib/exporting";
import DecisionButtons from "@/components/DecisionButtons";
import ProductImage from "@/components/ProductImage";
import { ChevronLeft, ChevronRight, FastForward, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

const SIZES = [2, 4, 6, 8, 10, 12, 14, 16];
const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function isComplete(item: ReviewItem) {
  const r = item.review;
  if (!r?.decision_status) return false;
  if (r.decision_status === "green" || r.decision_status === "yellow") {
    if (!Array.isArray(r.selected_sizes) || r.selected_sizes.length === 0) return false;
    if (r.requested_bulk_units == null) return false;
  }
  return true;
}

export default function Review() {
  const session = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const idx = Math.max(0, Math.min(items.length - 1, Number(params.get("i") ?? 0) || 0));
  const current = items[idx];

  useEffect(() => {
    if (!session) {
      navigate("/");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const data = await fetchAll(session.reviewer, session.store);
        if (!alive) return;
        setItems(data);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, navigate]);

  const completed = useMemo(() => items.filter(isComplete).length, [items]);
  const locked = current?.review?.submission_status === "submitted";

  const persist = (patch: Partial<{ decision_status: DecisionStatus | null; requested_bulk_units: number | null; notes: string | null; selected_sizes: number[] | null; special_order_notes: string | null }>) => {
    if (!session || !current) return;
    // optimistic update
    setItems((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const review = {
        ...(cur.review ?? {
          id: "",
          product_id: cur.product.id,
          reviewer: session.reviewer,
          store: session.store,
          decision_status: null,
          requested_bulk_units: null,
          notes: null,
          selected_sizes: [],
          special_order_notes: null,
          submission_status: "draft" as const,
          submitted_at: null,
          created_at: "",
          updated_at: "",
        }),
        ...patch,
      };
      next[idx] = { ...cur, review: review as any };
      return next;
    });

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const cur = items[idx];
        const merged = {
          decision_status: patch.decision_status !== undefined ? patch.decision_status : cur.review?.decision_status ?? null,
          requested_bulk_units:
            patch.requested_bulk_units !== undefined ? patch.requested_bulk_units : cur.review?.requested_bulk_units ?? null,
          notes: patch.notes !== undefined ? patch.notes : cur.review?.notes ?? null,
          selected_sizes: patch.selected_sizes !== undefined ? patch.selected_sizes : (cur.review?.selected_sizes ?? []),
          special_order_notes:
            patch.special_order_notes !== undefined ? patch.special_order_notes : cur.review?.special_order_notes ?? null,
        };
        const saved = await upsertReview({
          product_id: current.product.id,
          reviewer: session.reviewer,
          store: session.store,
          ...merged,
        });
        setItems((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], review: saved };
          return next;
        });
      } catch (e: any) {
        toast.error(e.message ?? "Save failed");
      } finally {
        setSaving(false);
      }
    }, 350);
  };

  const goto = (i: number) => setParams({ i: String(Math.max(0, Math.min(items.length - 1, i))) }, { replace: false });
  const next = () => goto(idx + 1);
  const prev = () => goto(idx - 1);
  const nextIncomplete = () => {
    for (let k = 1; k <= items.length; k++) {
      const j = (idx + k) % items.length;
      if (!isComplete(items[j])) return goto(j);
    }
    toast.success("All items complete — head to final review.");
  };

  if (loading) {
    return (
      <AppShell subtitle="Buying Review">
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading styles…
        </div>
      </AppShell>
    );
  }

  if (!current) {
    return (
      <AppShell subtitle="Buying Review">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No products to review yet.</p>
          <Button className="mt-4" onClick={() => navigate("/admin")}>Import worksheet</Button>
        </div>
      </AppShell>
    );
  }

  const r = current.review;
  const decision = r?.decision_status ?? null;
  const showUnits = decision === "green" || decision === "yellow" || decision === "red";

  return (
    <AppShell
      subtitle={`${session?.reviewer} · ${session?.store}`}
      right={
        <Button variant="outline" size="sm" onClick={() => navigate("/final")}>
          Final Review
        </Button>
      }
    >
      {/* Progress */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>Item {idx + 1} of {items.length}</span>
          <span>{completed} / {items.length} complete</span>
        </div>
        <Progress value={(completed / items.length) * 100} className="h-1.5" />
      </div>

      {locked && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> This style was already submitted and is locked.
        </div>
      )}

      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <ProductImage src={current.product.image_url} alt={current.product.long_style_desc} />

        <div className="space-y-5 p-5">
          <header>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Style {current.product.style_number}</p>
            <h1 className="mt-1 font-display text-2xl font-medium leading-tight">{current.product.long_style_desc}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-foreground/60" />
                {current.product.color}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium">{formatPrice(current.product.retail_price)}</span>
            </div>
          </header>

          {/* Decision */}
          <section>
            <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Decision</Label>
            <DecisionButtons
              value={decision}
              onChange={(v) => {
                const patch: Parameters<typeof persist>[0] = { decision_status: v };
                if (v === "red" && (r?.requested_bulk_units == null)) {
                  patch.requested_bulk_units = 0;
                }
                persist(patch);
              }}
              disabled={locked}
            />
          </section>

          {/* Requested Units */}
          {showUnits && (
            <section>
              <Label htmlFor="requested-units" className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Requested Units {(decision === "green" || decision === "yellow") && <span className="text-decision-red">*</span>}
              </Label>
              <Select
                disabled={locked}
                value={r?.requested_bulk_units != null ? String(r.requested_bulk_units) : ""}
                onValueChange={(v) => persist({ requested_bulk_units: v === "" ? null : Number(v) })}
              >
                <SelectTrigger id="requested-units" className="h-14 text-base">
                  <SelectValue placeholder="Select quantity" />
                </SelectTrigger>
                <SelectContent>
                  {QUANTITY_OPTIONS.map((q) => (
                    <SelectItem key={q} value={String(q)} className="py-3 text-base">
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          {/* Sizes */}
          {showUnits && (
            <section>
              <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Sizes {(decision === "green" || decision === "yellow") && <span className="text-decision-red">*</span>}
              </Label>
              <div className="grid grid-cols-8 gap-2">
                {SIZES.map((size) => {
                  const selected = (r?.selected_sizes ?? []).includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const cur = r?.selected_sizes ?? [];
                        const nextSizes = selected ? cur.filter((s) => s !== size) : [...cur, size].sort((a, b) => a - b);
                        persist({ selected_sizes: nextSizes });
                      }}
                      className={
                        "h-12 rounded-lg border text-sm font-medium transition active:scale-[0.97] disabled:opacity-50 " +
                        (selected
                          ? "border-foreground bg-foreground text-background shadow-soft"
                          : "border-border bg-card text-foreground hover:border-foreground/40")
                      }
                      aria-pressed={selected}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Special Order Notes */}
          {showUnits && (
            <section>
              <Label htmlFor="special-order-notes" className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Special Order Notes
              </Label>
              <Textarea
                id="special-order-notes"
                disabled={locked}
                value={r?.special_order_notes ?? ""}
                onChange={(e) => persist({ special_order_notes: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="e.g. Special cut, fabric swap, customer-specific request"
                className="resize-none text-base"
              />
            </section>
          )}

          {/* Notes */}
          <section>
            <Label htmlFor="notes" className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Notes <span className="font-normal normal-case tracking-normal text-muted-foreground/70">(client names, sizing, allocation)</span>
            </Label>
            <Textarea
              id="notes"
              disabled={locked}
              value={r?.notes ?? ""}
              onChange={(e) => persist({ notes: e.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Hold 1 size 6 for Ms. Walker; allocate 2 to private appointment list"
              className="resize-none text-base"
            />
          </section>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-decision-green" />}
              {saving ? "Saving…" : "Autosaved"}
            </span>
            <button onClick={nextIncomplete} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
              <FastForward className="h-3 w-3" /> Next incomplete
            </button>
          </div>
        </div>
      </article>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Button variant="outline" size="lg" onClick={prev} disabled={idx === 0} className="flex-1">
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          {idx === items.length - 1 ? (
            <Button size="lg" onClick={() => navigate("/final")} className="flex-1">
              Final Review
            </Button>
          ) : (
            <Button size="lg" onClick={next} className="flex-1">
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </nav>
    </AppShell>
  );
}
