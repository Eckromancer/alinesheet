// Buyer-side export model. Pure functions only — reads submitted reviews, never mutates them.
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Review = Tables<"reviews">;

export const SIZES = [2, 4, 6, 8, 10, 12, 14, 16] as const;

/** Door columns I–AF, in the exact sequence of Madison's NY sizing worksheet header. */
export const TEMPLATE_DOORS = [
  "8112-NP", "8111-FW", "8114-HO", "8115-BH", "8116-AT", "8209-NB", "8210-LA", "8218-FI",
  "8212-SF", "8214-WC", "8216-SD", "8219-MA", "8223-TY", "8224-PA", "8225-SH", "8226-DN",
  "8229-SC", "8230-KP", "8233-TR", "8232-CG", "8236-OR", "8238-BR", "8242-CH", "8073-NME",
] as const;

/**
 * Portal store label -> template door column, matched by store name only (needs buying-office
 * confirmation). Doors with no confident name match are intentionally absent and reported.
 */
export const STORE_TO_DOOR: Record<string, string> = {
  "1002 Northpark": "8112-NP",
  "1003 Ft. Worth": "8111-FW",
  "1004 Houston": "8114-HO",
  "1005 Bal Harbour": "8115-BH",
  "1006 Atlanta": "8116-AT",
  "1009 Northbrook": "8209-NB",
  "1010 Los Angeles": "8210-LA",
  "1011 Fashion Island": "8218-FI",
  "1012 San Francisco": "8212-SF",
  "1014 Westchester": "8214-WC",
  "1016 San Diego": "8216-SD",
  "1019 Michigan Avenue": "8219-MA",
  "1023 Tysons": "8223-TY",
  "1025 Short Hills": "8225-SH",
  "1027 Denver": "8226-DN",
  "1029 Scottsdale": "8229-SC",
  "1030 King Of Prussia": "8230-KP",
  "1033 Troy": "8233-TR",
  "1034 Coral Gables": "8232-CG",
  "1036 Orlando": "8236-OR",
  "1038 Boca Raton": "8238-BR",
  "1102 Charlotte": "8242-CH",
};

export type Allocation = Partial<Record<(typeof SIZES)[number], number>>;
export interface AllocationEntry { sizes: Allocation; acceptMismatch?: boolean }
/** key = `${productId}|${store}` */
export type Allocations = Record<string, AllocationEntry>;
/** key = `${productId}|${store}` -> chosen review id */
export type DuplicateChoices = Record<string, string>;

export const lineKey = (productId: string, store: string) => `${productId}|${store}`;

export interface Issue { kind: string; severity: "blocking" | "info"; detail: string }

/** Order products by an imported official sequence (exact style # [+ color]); else sort_order. */
export function orderProducts(products: Product[], sequence: string[] | null) {
  const base = [...products].sort((a, b) => a.sort_order - b.sort_order || a.style_number.localeCompare(b.style_number));
  if (!sequence?.length) return { ordered: base, verified: false, unmatched: [] as string[], missing: [] as Product[] };
  const used = new Set<string>();
  const ordered: Product[] = [];
  const unmatched: string[] = [];
  for (const raw of sequence) {
    const line = raw.trim();
    if (!line) continue;
    const [style, ...rest] = line.split(/[\t,; ]+/);
    const color = rest.join(" ").trim().toLowerCase();
    const hits = base.filter((p) => !used.has(p.id) && p.style_number === style && (!color || p.color.toLowerCase() === color));
    if (hits.length !== 1) { unmatched.push(line); continue; }
    used.add(hits[0].id);
    ordered.push(hits[0]);
  }
  const missing = base.filter((p) => !used.has(p.id));
  return { ordered: [...ordered, ...missing], verified: unmatched.length === 0 && missing.length === 0, unmatched, missing };
}

export interface Line { product: Product; store: string; review: Review }

/** Submitted reviews only; duplicates (same product+store, several reviews) need a buyer choice. */
export function resolveLines(products: Product[], reviews: Review[], choices: DuplicateChoices) {
  const pids = new Set(products.map((p) => p.id));
  const pmap = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<string, Review[]>();
  for (const r of reviews) {
    if (r.submission_status !== "submitted" || !pids.has(r.product_id)) continue;
    const k = lineKey(r.product_id, r.store);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const lines: Line[] = [];
  const duplicates: { key: string; product: Product; store: string; reviews: Review[] }[] = [];
  const issues: Issue[] = [];
  for (const [k, rs] of groups) {
    const product = pmap.get(rs[0].product_id)!;
    const store = rs[0].store;
    if (rs.length > 1) {
      duplicates.push({ key: k, product, store, reviews: rs });
      const chosen = rs.find((r) => r.id === choices[k]);
      if (!chosen) {
        issues.push({ kind: "Duplicate submission", severity: "blocking", detail: `${store} · ${product.style_number} ${product.color}: ${rs.length} submissions (${rs.map((r) => r.reviewer).join(", ")}) — choose the authoritative one; excluded until chosen.` });
        continue;
      }
      lines.push({ product, store, review: chosen });
    } else lines.push({ product, store, review: rs[0] });
  }
  return { lines, duplicates, issues };
}

export const units = (r: Review) => (r.decision_status === "red" ? 0 : r.requested_bulk_units ?? 0);

export function allocationStatus(line: Line, a: AllocationEntry | undefined) {
  const total = units(line.review);
  const sum = SIZES.reduce((s, z) => s + (a?.sizes[z] ?? 0), 0);
  if (total === 0 && sum === 0) return { total, sum, state: "none" as const };
  if (sum === 0) return { total, sum, state: "missing" as const };
  if (sum === total) return { total, sum, state: "ok" as const };
  return { total, sum, state: a?.acceptMismatch ? ("accepted" as const) : ("mismatch" as const) };
}

export function validate(products: Product[], lines: Line[], allocations: Allocations, knownStores: string[]) {
  const issues: Issue[] = [];
  for (const p of products) {
    if (p.retail_price == null) issues.push({ kind: "Missing MSRP", severity: "info", detail: `${p.style_number} ${p.color}` });
  }
  issues.push({ kind: "Class not in source data", severity: "info", detail: "Column D (Class) is left blank — the 2027 assortment records carry no class field." });
  const usedDoors = new Set(Object.values(STORE_TO_DOOR));
  issues.push({ kind: "Unverified door mapping", severity: "info", detail: "Store-to-door columns are matched by store name only and need buying-office confirmation." });
  for (const d of TEMPLATE_DOORS) if (!usedDoors.has(d)) issues.push({ kind: "Template door with no portal store", severity: "info", detail: `${d} — column kept, left empty.` });
  const unmapped = new Set<string>();
  for (const s of knownStores) if (!STORE_TO_DOOR[s]) unmapped.add(s);
  for (const l of lines) if (!STORE_TO_DOOR[l.store]) unmapped.add(l.store);
  for (const s of unmapped) {
    const n = lines.filter((l) => l.store === s && units(l.review) > 0).length;
    issues.push({ kind: "Unmatched door", severity: n ? "blocking" : "info", detail: `${s} has no column in the template${n ? ` — ${n} submitted line(s) with units are NOT in the sizing matrix` : ""}.` });
  }
  for (const l of lines) {
    const st = allocationStatus(l, allocations[lineKey(l.product.id, l.store)]);
    const where = `${l.store} · ${l.product.style_number} ${l.product.color}`;
    if (st.state === "missing") issues.push({ kind: "Size split missing", severity: "blocking", detail: `${where}: ${st.total} unit(s) requested; DSA size preferences (not quantities): ${l.review.selected_sizes.join("/") || "none"}. Size cells left blank.` });
    if (st.state === "mismatch") issues.push({ kind: "Size total mismatch", severity: "blocking", detail: `${where}: allocated ${st.sum} vs requested ${st.total}.` });
    if (st.state === "accepted") issues.push({ kind: "Buyer-accepted total change", severity: "info", detail: `${where}: allocated ${st.sum} vs requested ${st.total}.` });
    if (units(l.review) > 0 && !l.review.selected_sizes.length) issues.push({ kind: "No size preference from DSA", severity: "info", detail: where });
  }
  return issues;
}
