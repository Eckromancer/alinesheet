// Fixed door allocations (buyer-predetermined pieces per style/color). Pure helpers, no I/O.
export const QUOTA_SIZES = [2, 4, 6, 8, 10, 12, 14, 16] as const;
export type SizeCounts = Record<string, number>;

/** Seasons/doors where the DSA only distributes a fixed allocation across sizes. All others keep the request workflow. */
export const QUOTA_WORKFLOWS = [{ season: "Pre-Fall 2027", store: "1019 Michigan Avenue", door: "8219-MA" }] as const;

export function quotaWorkflowFor(season: string | null | undefined, store: string | null | undefined) {
  return QUOTA_WORKFLOWS.find((w) => w.season === season && w.store === store) ?? null;
}

/** Match by trimmed style number + case-insensitive trimmed color — never style number alone. */
export const matchKey = (style: string, color: string) => `${style.trim()}|${color.trim().toLowerCase()}`;

export function normalizeCounts(raw: unknown): SizeCounts {
  const out: SizeCounts = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const z of QUOTA_SIZES) {
    const v = (raw as Record<string, unknown>)[String(z)];
    if (typeof v === "number" && Number.isInteger(v) && v > 0) out[String(z)] = v;
  }
  return out;
}

export const countTotal = (c: SizeCounts) => Object.values(c).reduce((s, n) => s + (n || 0), 0);

/** +/- one piece on a size, never below 0 and never above the fixed quota. */
export function adjustCount(c: SizeCounts, size: number, delta: number, quota: number | null): SizeCounts {
  if (quota == null) return c;
  const key = String(size);
  const cur = c[key] ?? 0;
  const next = cur + delta;
  if (next < 0 || (delta > 0 && countTotal(c) + delta > quota)) return c;
  const out = { ...c };
  if (next === 0) delete out[key]; else out[key] = next;
  return out;
}

export type QuotaState = "missing_quota" | "empty" | "partial" | "complete" | "excess";
export function quotaState(c: SizeCounts, quota: number | null): QuotaState {
  if (quota == null) return "missing_quota";
  const t = countTotal(c);
  if (t > quota) return "excess";
  if (t === quota) return "complete";
  return t === 0 ? "empty" : "partial";
}

/** Quota info per product for a door: undefined = no allocation line; quota null = buyer allocation missing. */
export interface QuotaInfo { quota: number | null }

/** Shared DSA validation for quota workflows. Returns null when nothing blocks finalization. */
export function quotaIssue(info: QuotaInfo | undefined, counts: SizeCounts): string | null {
  if (!info || info.quota == null) return null; // not required: no line or buyer allocation missing
  const st = quotaState(counts, info.quota);
  if (st === "complete") return null;
  const t = countTotal(counts);
  return st === "excess" ? `Sizes ${t} exceed allocation ${info.quota}` : `Sizes ${t} of ${info.quota} chosen`;
}

/** Known source-vs-app discrepancies flagged during the MA.xlsx reconciliation. Never auto-applied. */
export const SOURCE_AUDIT_FLAGS = [
  { style: "2701514803222707", color: "ecru-yellow", note: "Source MSRP $1,990 vs app $1,890 — app price not changed; buyer to confirm." },
];

export interface QuotaRow { style_number: string; color: string; product_id: string | null; quota: number | null; source_seq: number | null }
export interface QuotaSheetProduct { id: string; style_number: string; color: string; long_style_desc: string; retail_price: number | null; image_url: string | null }
export interface QuotaSheetLine {
  style: string; color: string; description: string; msrp: number | null; productId: string | null;
  quota: number | null; counts: SizeCounts | null; state: QuotaState | "unlinked" | "not_submitted"; required: boolean;
}

/**
 * Single-door export model in source order. Counts come only from SUBMITTED reviews; drafts and
 * unlinked/missing lines leave size cells blank. Nothing is estimated.
 */
export function buildQuotaSheet(rows: QuotaRow[], products: QuotaSheetProduct[], submitted: Map<string, SizeCounts>) {
  const pm = new Map(products.map((p) => [p.id, p]));
  const lines: QuotaSheetLine[] = [...rows]
    .sort((a, b) => (a.source_seq ?? 1e9) - (b.source_seq ?? 1e9))
    .map((r) => {
      const p = r.product_id ? pm.get(r.product_id) : undefined;
      const base = { style: r.style_number, color: r.color, description: p?.long_style_desc ?? "", msrp: p?.retail_price ?? null, productId: p?.id ?? null, quota: r.quota };
      if (!p) return { ...base, counts: null, state: "unlinked" as const, required: false };
      if (r.quota == null) return { ...base, counts: null, state: "missing_quota" as const, required: false };
      const c = submitted.get(p.id);
      if (!c) return { ...base, counts: null, state: "not_submitted" as const, required: true };
      return { ...base, counts: c, state: quotaState(c, r.quota), required: true };
    });
  const complete = lines.filter((l) => l.required && l.state === "complete").length;
  const required = lines.filter((l) => l.required).length;
  return { lines, complete, required, isDraft: complete < required || lines.some((l) => !l.required) };
}
