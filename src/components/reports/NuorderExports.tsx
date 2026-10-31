import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle } from "lucide-react";
import { seasonSlug } from "@/lib/seasons";
import { STORES } from "@/lib/stores";
import {
  SIZES, lineKey, orderProducts, resolveLines, validate, allocationStatus, units,
  type Allocations, type DuplicateChoices, type Product, type Review,
} from "@/lib/nuorder/model";
import { buildColorByItemWorkbook, buildSizingWorkbook, buildDoorSizingWorkbook } from "@/lib/nuorder/workbooks";
import { STORE_TO_DOOR } from "@/lib/nuorder/model";
import { supabase } from "@/integrations/supabase/client";

interface Props { season: string; products: Product[]; reviews: Review[] }
interface Ready { url: string; name: string; label: string }

function useSessionState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(init);
  useEffect(() => {
    try { const raw = sessionStorage.getItem(key); setV(raw ? JSON.parse(raw) : init); } catch { setV(init); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (next: T) => { setV(next); try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } };
  return [v, set] as const;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function NuorderExports({ season, products, reviews }: Props) {
  const slug = seasonSlug(season || "season");
  const [sequenceText, setSequenceText] = useSessionState<string>(`alne-nuorder-seq-${slug}`, "");
  const [allocations, setAllocations] = useSessionState<Allocations>(`alne-nuorder-alloc-${slug}`, {});
  const [choices, setChoices] = useSessionState<DuplicateChoices>(`alne-nuorder-dupes-${slug}`, {});
  const [ready, setReady] = useState<Ready[]>([]);
  const [busy, setBusy] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [door, setDoor] = useState<string>("__all");
  const [includeNotes, setIncludeNotes] = useState(false);

  const seq = useMemo(() => orderProducts(products, sequenceText.trim() ? sequenceText.split("\n") : null), [products, sequenceText]);
  const sequenceNote = seq.verified
    ? "Buyer-imported official NuORDER sequence (all styles matched exactly)."
    : sequenceText.trim()
      ? `Imported sequence incomplete: ${seq.unmatched.length} unmatched line(s), ${seq.missing.length} style(s) appended in assortment order.`
      : "Linesheet order (sort_order) — not verified against NuORDER.";
  const { lines, duplicates, issues: dupIssues } = useMemo(() => resolveLines(seq.ordered, reviews, choices), [seq.ordered, reviews, choices]);
  const issues = useMemo(
    () => [...dupIssues, ...validate(seq.ordered, lines, allocations, STORES.map((s) => s.label))],
    [dupIssues, seq.ordered, lines, allocations],
  );
  const blocking = issues.filter((i) => i.severity === "blocking");
  const doorCode = door === "__all" ? undefined : STORE_TO_DOOR[door];
  const toAllocate = lines.filter((l) => units(l.review) > 0 && (door === "__all" || l.store === door));

  // Signed-in buyers: approved bulk + sizes are saved to the backend (buyer-only). Otherwise kept in this tab.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const ids = products.map((p) => p.id);
    if (!ids.length) return;
    supabase.from("buyer_allocations").select("product_id,store,approved_units,sizes").in("product_id", ids).then(({ data, error }) => {
      if (error || !data) return;
      setSaved(true);
      if (!data.length) return;
      const next = { ...allocations };
      for (const row of data) next[lineKey(row.product_id, row.store)] = { sizes: (row.sizes ?? {}) as Allocations[string]["sizes"], approved: row.approved_units };
      setAllocations(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);
  const persistAlloc = (key: string, entry: Allocations[string]) => {
    setAllocations({ ...allocations, [key]: entry });
    const [product_id, ...rest] = key.split("|");
    supabase.from("buyer_allocations").upsert({ product_id, store: rest.join("|"), season, approved_units: entry.approved ?? null, sizes: entry.sizes })
      .then(({ error }) => setSaved(!error));
  };

  useEffect(() => () => ready.forEach((r) => URL.revokeObjectURL(r.url)), [ready]);

  const prepare = async (kind: "color" | "sizing") => {
    setBusy(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      let wb;
      if (kind === "color") {
        wb = await buildColorByItemWorkbook({ products: seq.ordered, lines, issues, season, sequenceVerified: seq.verified, sequenceNote, store: door === "__all" ? undefined : door, includeNotes });
      } else {
        const images = new Map<string, ArrayBuffer>();
        await Promise.all(seq.ordered.map(async (p) => {
          if (!p.image_url) return;
          try { const res = await fetch(p.image_url); if (res.ok) images.set(p.id, await res.arrayBuffer()); } catch { /* image optional */ }
        }));
        if (doorCode) {
          const out = await buildDoorSizingWorkbook({ products: seq.ordered, lines, allocations, store: door, door: doorCode, sequenceNote, images });
          const buf = await out.wb.xlsx.writeBuffer();
          const url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
          const name = `${out.blocking ? "DRAFT-" : ""}sizing-${doorCode}-${slug}-${date}.xlsx`;
          setReady((prev) => [...prev.filter((r) => !r.name.includes("sizing")), { url, name, label: `Sizing ${doorCode}${out.blocking ? " (DRAFT)" : ""}` }]);
          return;
        }
        wb = await buildSizingWorkbook({ products: seq.ordered, lines, allocations, issues, sequenceNote, images, unresolvedDuplicates: duplicates.filter((d) => !d.reviews.some((r) => r.id === choices[d.key])).map((d) => d.key) });
      }
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
      const draft = kind === "sizing" && blocking.length ? "DRAFT-" : "";
      const doorSlug = door === "__all" ? "all-doors" : seasonSlug(door);
      const name = kind === "color" ? `color-by-item-${doorSlug}-${slug}-${date}.xlsx` : `${draft}sizing-worksheet-${slug}-${date}.xlsx`;
      setReady((prev) => [...prev.filter((r) => !r.name.startsWith(kind === "color" ? "color" : draft ? "DRAFT" : "sizing")), { url, name, label: kind === "color" ? "Color by Item" : draft ? "Sizing worksheet (DRAFT)" : "Sizing worksheet" }]);
    } finally { setBusy(false); }
  };

  const setSize = (key: string, z: number, v: string) => {
    const n = v === "" ? undefined : Math.max(0, Math.floor(Number(v)) || 0);
    const cur = allocations[key] ?? { sizes: {} };
    persistAlloc(key, { ...cur, sizes: { ...cur.sizes, [z]: n } });
  };
  const setApproved = (key: string, v: string) => {
    const cur = allocations[key] ?? { sizes: {} };
    persistAlloc(key, { ...cur, approved: v === "" ? null : Math.max(0, Math.floor(Number(v)) || 0) });
  };

  const box = "border-t border-foreground pt-5";
  const eyebrow = "text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num";

  return (
    <section className="mt-16 space-y-12">
      <div className={box}>
        <span className={eyebrow}>03</span>
        <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">NuORDER Exports</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Color-by-item per door and a sizing worksheet in the NY sizing sheet layout, built from submitted {season} reviews only.
          Downloads stay on this device. Door totals come straight from DSA submissions; size cells stay blank (DSA sizes are preferences, not quantities). DSA and client notes are left out unless you tick the box.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Select value={door} onValueChange={setDoor}>
            <SelectTrigger aria-label="Door for color by item" className="h-9 w-56 rounded-none border-foreground bg-background text-xs uppercase tracking-[0.12em]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All doors</SelectItem>
              {[...new Set([...STORES.map((s) => s.label), ...lines.map((l) => l.store)])].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} /> Include private notes
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button size="sm" variant="outline" disabled={busy} className="rounded-none border-foreground text-[11px] uppercase tracking-[0.22em]" onClick={() => prepare("color")}>
            Prepare Color by Item
          </Button>
          <Button size="sm" variant="outline" disabled={busy} className="rounded-none border-foreground text-[11px] uppercase tracking-[0.22em]" onClick={() => prepare("sizing")}>
            {doorCode ? `Prepare Sizing ${doorCode}` : `Prepare Sizing Worksheet${blocking.length ? " (Draft)" : ""}`}
          </Button>
          {ready.map((r) => (
            <Button key={r.name} asChild size="sm" className="rounded-none text-[11px] uppercase tracking-[0.22em]">
              <a href={r.url} download={r.name}><Download className="mr-2 h-3.5 w-3.5" /> {r.label}</a>
            </Button>
          ))}
        </div>
        <p className={`mt-4 text-xs ${seq.verified ? "text-muted-foreground" : "text-destructive"}`}>
          {seq.verified ? "" : "Sequence unverified — "}{sequenceNote}
        </p>
        {blocking.length > 0 && (
          <p className="mt-2 flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            DRAFT — size split missing or unresolved ({blocking.length} item(s)). The sizing file still downloads with door totals filled; the Validation sheet lists what's open.
          </p>
        )}
      </div>

      <details className={box}>
        <summary className={`${eyebrow} cursor-pointer`}>Advanced — style order reference (optional)</summary>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          Optional. Paste a {season} style order you have, one line per style (style # and optionally color). Used as a reference only; the app cannot verify it against NuORDER.
        </p>
        <Textarea value={sequenceText} onChange={(e) => setSequenceText(e.target.value)} rows={4} className="mt-3 max-w-2xl rounded-none font-mono text-xs" placeholder={"7701106905008146 cerulean\n7701120400034507"} />
        {seq.unmatched.length > 0 && <p className="mt-2 text-xs text-destructive">Unmatched: {seq.unmatched.slice(0, 8).join(" · ")}{seq.unmatched.length > 8 ? " …" : ""}</p>}
      </details>

      {duplicates.length > 0 && (
        <div className={box}>
          <span className={eyebrow}>Duplicate submissions — choose authoritative</span>
          <div className="mt-4 space-y-3">
            {duplicates.map((d) => (
              <div key={d.key} className="border border-[hsl(var(--hairline))] p-3 text-xs">
                <p className="font-medium">{d.store} · {d.product.style_number} {d.product.color}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.reviews.map((r) => (
                    <Button key={r.id} size="sm" variant={choices[d.key] === r.id ? "default" : "outline"} className="h-auto rounded-none py-1 text-[11px]"
                      onClick={() => setChoices({ ...choices, [d.key]: r.id })}>
                      {r.reviewer} · {(r.decision_status ?? "—").toUpperCase()} · {r.requested_bulk_units ?? 0}u · {r.selected_sizes.join("/") || "no sizes"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className={box}>
        <summary className={`${eyebrow} cursor-pointer`}>Advanced — optional size entry fallback ({toAllocate.filter((l) => ["ok", "accepted"].includes(allocationStatus(l, allocations[lineKey(l.product.id, l.store)]).state)).length}/{toAllocate.length} confirmed)</summary>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">Optional. Approved bulk is your number, separate from the DSA request; blank = not allocated. Sizes must add up to approved bulk. {saved ? "Saved to your buyer account." : "Kept in this browser tab only (sign in as a buyer to save)."} Pick a door above to see just that door.</p>
        <div className="mt-4 divide-y divide-[hsl(var(--hairline))] border-y border-[hsl(var(--hairline))]">
          {toAllocate.length === 0 && <p className="py-3 text-xs text-muted-foreground">No submitted lines with units for this season.</p>}
          {toAllocate.map((l) => {
            const key = lineKey(l.product.id, l.store);
            const a = allocations[key];
            const st = allocationStatus(l, a);
            const open = openKey === key;
            const tone = st.state === "ok" || st.state === "accepted" ? "text-muted-foreground" : "text-destructive";
            return (
              <div key={key} className="py-2 text-xs">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpenKey(open ? null : key)}>
                  <span>{l.store} · <span className="font-mono">{l.product.style_number}</span> {l.product.color}</span>
                  <span className={tone}>{st.sum}/{st.total} · {st.state === "ok" ? "confirmed" : st.state === "accepted" ? "buyer-accepted" : st.state}</span>
                </button>
                {open && (
                  <div className="mt-3 space-y-2">
                    <p className="text-muted-foreground">DSA {l.review.reviewer}: {st.total} unit(s), preferred sizes {l.review.selected_sizes.join(", ") || "none"}{l.review.notes ? ` · “${l.review.notes}”` : ""}</p>
                    <label className="flex items-center gap-2">
                      Approved bulk
                      <input type="number" min={0} inputMode="numeric" aria-label="Approved bulk" value={a?.approved ?? ""} onChange={(e) => setApproved(key, e.target.value)}
                        className="h-8 w-14 border border-[hsl(var(--hairline))] bg-background text-center" />
                      <span className="text-muted-foreground">(DSA requested {units(l.review)})</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SIZES.map((z) => (
                        <label key={z} className={`flex flex-col items-center gap-1 ${l.review.selected_sizes.includes(z) ? "font-semibold" : "text-muted-foreground"}`}>
                          {z}
                          <input type="number" min={0} inputMode="numeric" value={a?.sizes[z] ?? ""} onChange={(e) => setSize(key, z, e.target.value)}
                            className="h-8 w-12 border border-[hsl(var(--hairline))] bg-background text-center" />
                        </label>
                      ))}
                    </div>
                    {st.sum > 0 && st.sum !== st.total && (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!a?.acceptMismatch} onChange={(e) => persistAlloc(key, { ...(a ?? { sizes: {} }), acceptMismatch: e.target.checked })} />
                        Buyer approves {st.sum} units instead of the DSA's {st.total}
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
