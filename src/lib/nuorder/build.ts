import ExcelJS from "exceljs";
import type { Tables } from "@/integrations/supabase/types";
import { STORES } from "@/lib/stores";
import { TEMPLATE_STYLES, type TemplateStyle } from "./template";

type Product = Tables<"products">;
type Review = Tables<"reviews">;

export const SIZES = [2, 4, 6, 8, 10, 12, 14, 16] as const;

/** Door columns I..AF exactly as in Madison's workbook. `app` = matching app store code, null = no app store. */
export const DOOR_COLUMNS: { code: string; app: string | null }[] = [
  { code: "8112-NP", app: "1002" }, { code: "8111-FW", app: "1003" }, { code: "8114-HO", app: "1004" },
  { code: "8115-BH", app: "1005" }, { code: "8116-AT", app: "1006" }, { code: "8209-NB", app: "1009" },
  { code: "8210-LA", app: "1010" }, { code: "8218-FI", app: "1011" }, { code: "8212-SF", app: "1012" },
  { code: "8214-WC", app: "1014" }, { code: "8216-SD", app: "1016" }, { code: "8219-MA", app: "1019" },
  { code: "8223-TY", app: "1023" }, { code: "8224-PA", app: null }, { code: "8225-SH", app: "1025" },
  { code: "8226-DN", app: "1027" }, { code: "8229-SC", app: "1029" }, { code: "8230-KP", app: "1030" },
  { code: "8233-TR", app: "1033" }, { code: "8232-CG", app: "1034" }, { code: "8236-OR", app: "1036" },
  { code: "8238-BR", app: "1038" }, { code: "8242-CH", app: "1102" }, { code: "8073-NME", app: null },
];

export const HEADERS = [
  "Image", "Style #", "Color", "Class", "Style Description", "US MSRP", "Sizes", "Total Units",
  ...DOOR_COLUMNS.map((d) => d.code),
];

export const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const key = (style: string, color: string) => `${style.trim()}|${norm(color)}`;
const storeCode = (storeLabel: string) => storeLabel.split(" ")[0];

/** Buyer-confirmed allocation: store code + product id -> size -> units. Never derived from selected sizes. */
export type SizeAllocations = Map<string, Partial<Record<number, number>>>;
export const allocationKey = (productId: string, appStoreCode: string) => `${productId}|${appStoreCode}`;

export interface ExportIssue { type: string; detail: string }

/** One submitted review per product+store: the most recently submitted wins; extra reviewers are flagged, never summed. */
export function dedupeReviews(reviews: Review[]) {
  const issues: ExportIssue[] = [];
  const byKey = new Map<string, Review[]>();
  for (const r of reviews) {
    if (r.submission_status !== "submitted") continue;
    const k = `${r.product_id}|${r.store}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const kept: Review[] = [];
  for (const group of byKey.values()) {
    group.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
    kept.push(group[0]);
    if (group.length > 1) {
      issues.push({
        type: "Duplicate submission",
        detail: `${group[0].store}: ${group.length} reviewers (${group.map((g) => g.reviewer).join(", ")}) on one style — kept latest from ${group[0].reviewer}, others excluded`,
      });
    }
  }
  return { reviews: kept, issues };
}

export interface ExportInput {
  season: string;
  products: Product[];
  reviews: Review[];
  allocations?: SizeAllocations;
}

export function analyze({ season, products, reviews }: ExportInput) {
  const seasonProducts = products.filter((p) => p.season === season);
  const byKey = new Map(seasonProducts.map((p) => [key(p.style_number, p.color), p]));
  const templateKeys = new Set(TEMPLATE_STYLES.map((t) => key(t.styleNumber, t.color)));
  const matched = new Map<number, Product>();
  TEMPLATE_STYLES.forEach((t) => {
    const p = byKey.get(key(t.styleNumber, t.color));
    if (p) matched.set(t.sourceRow, p);
  });
  const unmatchedProducts = seasonProducts.filter((p) => !templateKeys.has(key(p.style_number, p.color)));
  const unmatchedTemplate = TEMPLATE_STYLES.filter((t) => !matched.has(t.sourceRow));

  const ids = new Set(seasonProducts.map((p) => p.id));
  const { reviews: deduped, issues } = dedupeReviews(reviews.filter((r) => ids.has(r.product_id)));
  const mappedApp = new Set(DOOR_COLUMNS.map((d) => d.app).filter(Boolean));
  const unmappedStores = [...new Set(deduped.map((r) => r.store))].filter((s) => !mappedApp.has(storeCode(s)));

  issues.push(
    ...unmatchedProducts.map((p) => ({ type: "Product not in sizing workbook", detail: `${p.style_number} ${p.color} — ${p.long_style_desc.slice(0, 60)}` })),
    ...unmatchedTemplate.map((t) => ({ type: "Workbook style not in app", detail: `Row ${t.sourceRow}: ${t.styleNumber} ${t.color.trim()}` })),
    ...unmappedStores.map((s) => ({ type: "Store has no NuORDER column", detail: `${s} — demand excluded from sizing matrix` })),
    ...DOOR_COLUMNS.filter((d) => !d.app).map((d) => ({ type: "NuORDER door has no app store", detail: `${d.code} — left blank` })),
  );
  return { seasonProducts, matched, unmatchedProducts, unmatchedTemplate, reviews: deduped, unmappedStores, issues };
}

const col = (i: number) => {
  let s = ""; let n = i;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
export const FIRST_DOOR_COL = 9; // I
export const LAST_DOOR_COL = 8 + DOOR_COLUMNS.length; // AF

/** Sizing matrix replicating Madison's Sheet 1 layout: 10 rows per style-color block, same order and columns A–AF. */
export function buildSizingWorkbook(input: ExportInput) {
  const a = analyze(input);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet 1");
  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };
  const I = col(FIRST_DOOR_COL), AF = col(LAST_DOOR_COL);
  const pendingAllocation: ExportIssue[] = [];

  TEMPLATE_STYLES.forEach((t: TemplateStyle) => {
    const top = t.sourceRow;
    const p = a.matched.get(top);
    const header = ws.getRow(top);
    header.getCell(2).value = t.styleNumber;
    header.getCell(3).value = t.color;
    header.getCell(4).value = t.className;
    header.getCell(5).value = t.description;
    header.getCell(6).value = t.msrp;
    let total = 0;
    DOOR_COLUMNS.forEach((d, i) => {
      if (!p || !d.app) return;
      const r = a.reviews.find((rv) => rv.product_id === p.id && storeCode(rv.store) === d.app);
      const units = r?.requested_bulk_units ?? 0;
      if (!units) return;
      header.getCell(FIRST_DOOR_COL + i).value = units; // "Total Units" header = DSA requested units
      total += units;
      const alloc = input.allocations?.get(allocationKey(p.id, d.app));
      SIZES.forEach((size, si) => {
        const q = alloc?.[size];
        if (q) ws.getRow(top + 1 + si).getCell(FIRST_DOOR_COL + i).value = q;
      });
      const allocated = SIZES.reduce((s, size) => s + (alloc?.[size] ?? 0), 0);
      if (allocated !== units) {
        pendingAllocation.push({
          type: alloc ? "Allocation ≠ requested units" : "Awaiting buyer size allocation",
          detail: `${t.styleNumber} ${t.color.trim()} @ ${d.code}: requested ${units}, sized ${allocated}`,
        });
      }
    });
    if (total) header.getCell(8).value = total;
    SIZES.forEach((size, si) => {
      const r = top + 1 + si;
      ws.getCell(`G${r}`).value = size;
      ws.getCell(`H${r}`).value = { formula: `SUM(${I}${r}:${AF}${r})` };
    });
    const sub = top + 9;
    for (let c = 8; c <= LAST_DOOR_COL; c++) {
      const L = col(c);
      ws.getCell(`${L}${sub}`).value = { formula: `SUM(${L}${top + 1}:${L}${top + 8})` };
    }
    ws.getRow(sub).font = { bold: true };
  });
  ws.views = [{ state: "frozen", xSplit: 11, ySplit: 486 }];
  [8, 18, 12, 14, 40, 10, 7, 11].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const issues = [...a.issues, ...pendingAllocation];
  addIssuesSheet(wb, input.season, issues);
  if (a.unmatchedProducts.length) {
    const u = wb.addWorksheet("Unmatched app products");
    u.addRow(["Style #", "Color", "Description", "US MSRP", ...DOOR_COLUMNS.map((d) => d.code)]);
    a.unmatchedProducts.forEach((p) => {
      u.addRow([p.style_number, p.color, p.long_style_desc, p.retail_price ?? "", ...DOOR_COLUMNS.map((d) => {
        const r = a.reviews.find((rv) => rv.product_id === p.id && d.app && storeCode(rv.store) === d.app);
        return r?.requested_bulk_units ?? null;
      })]);
    });
  }
  return { workbook: wb, issues, analysis: a };
}

function addIssuesSheet(wb: ExcelJS.Workbook, season: string, issues: ExportIssue[]) {
  const s = wb.addWorksheet("Validation");
  s.addRow([`${season} — items to resolve before NuORDER upload`]);
  s.addRow(["Type", "Detail"]);
  if (!issues.length) s.addRow(["OK", "No issues found"]);
  issues.forEach((i) => s.addRow([i.type, i.detail]));
  s.getColumn(1).width = 32; s.getColumn(2).width = 100;
}

/** Color-by-item: one sheet per door; color banners in NuORDER order; styles nested in NuORDER sequence. */
export function buildColorByItemWorkbook(input: ExportInput) {
  const a = analyze(input);
  const wb = new ExcelJS.Workbook();
  const seq: { product: Product; className: string; verified: boolean }[] = [
    ...TEMPLATE_STYLES.filter((t) => a.matched.has(t.sourceRow)).map((t) => ({ product: a.matched.get(t.sourceRow)!, className: t.className, verified: true })),
    ...a.unmatchedProducts
      .slice()
      .sort((x, y) => x.sort_order - y.sort_order)
      .map((p) => ({ product: p, className: "", verified: false })),
  ];
  const colorOrder: string[] = [];
  seq.forEach((s) => { const c = norm(s.product.color); if (!colorOrder.includes(c)) colorOrder.push(c); });

  const doors = STORES.filter((s) => a.reviews.some((r) => r.store === s.label));
  doors.forEach((store) => {
    const nu = DOOR_COLUMNS.find((d) => d.app === store.code)?.code ?? "no NuORDER code";
    const ws = wb.addWorksheet(`${store.code} ${store.name}`.slice(0, 31));
    ws.addRow([`${store.label} (${nu}) — ${input.season} Color by Item`]).font = { bold: true, size: 13 };
    ws.addRow(["Style #", "Class", "Style Description", "US MSRP", "Decision", "Requested Units", "Sizes Selected", "Notes", "Client Notes", "Sequence"]).font = { bold: true };
    colorOrder.forEach((color) => {
      const items = seq.filter((s) => norm(s.product.color) === color)
        .map((s) => ({ ...s, review: a.reviews.find((r) => r.product_id === s.product.id && r.store === store.label) }))
        .filter((s) => s.review);
      if (!items.length) return;
      const banner = ws.addRow([color.toUpperCase()]);
      banner.font = { bold: true };
      banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E4DC" } };
      items.forEach(({ product: p, className, verified, review: r }) => {
        ws.addRow([p.style_number, className, p.long_style_desc, p.retail_price ?? null, r!.decision_status ?? "",
          r!.requested_bulk_units ?? null, r!.selected_sizes?.join(" ") ?? "", r!.notes ?? "", r!.special_order_notes ?? "",
          verified ? "NuORDER verified" : "Unverified — not in sizing workbook"]);
      });
    });
    [18, 14, 50, 10, 10, 10, 18, 30, 30, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  });
  if (!doors.length) wb.addWorksheet("No submissions").addRow(["No submitted reviews for this season"]);
  addIssuesSheet(wb, input.season, a.issues);
  return { workbook: wb, issues: a.issues, analysis: a };
}

export async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
