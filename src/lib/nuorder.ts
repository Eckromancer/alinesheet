import type { Tables } from "@/integrations/supabase/types";

type Review = Tables<"reviews">;
type Product = Tables<"products">;

export const SIZES = [2, 4, 6, 8, 10, 12, 14, 16];

// Door columns in Madison's Nuorder sizing worksheet order, mapped to app store names.
export const DOORS: Array<{ code: string; store: string | null }> = [
  { code: "8112-NP", store: "Northpark" },
  { code: "8111-FW", store: "Ft. Worth" },
  { code: "8114-HO", store: "Houston" },
  { code: "8115-BH", store: "Bal Harbour" },
  { code: "8116-AT", store: "Atlanta" },
  { code: "8209-NB", store: "Northbrook" },
  { code: "8210-LA", store: "Los Angeles" },
  { code: "8218-FI", store: "Fashion Island" },
  { code: "8212-SF", store: "San Francisco" },
  { code: "8214-WC", store: "Westchester" },
  { code: "8216-SD", store: "San Diego" },
  { code: "8219-MA", store: "Michigan Avenue" },
  { code: "8223-TY", store: "Tysons" },
  { code: "8224-PA", store: null },
  { code: "8225-SH", store: "Short Hills" },
  { code: "8226-DN", store: "Denver" },
  { code: "8229-SC", store: "Scottsdale" },
  { code: "8230-KP", store: "King Of Prussia" },
  { code: "8233-TR", store: "Troy" },
  { code: "8232-CG", store: "Coral Gables" },
  { code: "8236-OR", store: "Orlando" },
  { code: "8238-BR", store: "Boca Raton" },
  { code: "8242-CH", store: "Charlotte" },
  { code: "8073-NME", store: null },
];

/** Split total units evenly across selected sizes; remainder goes to the smallest sizes first. */
export function allocateUnits(units: number, sizes: number[]): Map<number, number> {
  const out = new Map<number, number>();
  const s = [...new Set(sizes)].sort((a, b) => a - b);
  if (!s.length || units <= 0) return out;
  const base = Math.floor(units / s.length);
  let rem = units - base * s.length;
  s.forEach((size) => {
    out.set(size, base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem -= 1;
  });
  return out;
}

function storeName(label: string) {
  return label.replace(/^\d+\s+/, "");
}

/** Column headers: worksheet doors plus any app stores not in the worksheet (e.g. Downtown, Boston). */
export function doorColumns(reviews: Review[]) {
  const known = new Set(DOORS.map((d) => d.store).filter(Boolean) as string[]);
  const extras = [...new Set(reviews.map((r) => storeName(r.store)))].filter((n) => !known.has(n)).sort();
  return [...DOORS, ...extras.map((n) => ({ code: n, store: n }))];
}

/** qty[productId][doorCode][size] from submitted, non-red reviews. */
export function buildQuantities(reviews: Review[]) {
  const qty = new Map<string, Map<string, Map<number, number>>>();
  const cols = doorColumns(reviews);
  reviews.forEach((r) => {
    if (r.decision_status === "red") return;
    const door = cols.find((c) => c.store === storeName(r.store));
    if (!door) return;
    const alloc = allocateUnits(r.requested_bulk_units ?? 0, r.selected_sizes ?? []);
    const p = qty.get(r.product_id) ?? new Map();
    const d = p.get(door.code) ?? new Map();
    alloc.forEach((v, size) => d.set(size, (d.get(size) ?? 0) + v));
    p.set(door.code, d);
    qty.set(r.product_id, p);
  });
  return { qty, cols };
}

function colLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

async function download(wb: import("exceljs").Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportSizingMatrix(products: Product[], reviews: Review[], season: string, filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const { qty, cols } = buildQuantities(reviews);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sizing");
  const first = 9; // column I
  const last = first + cols.length - 1;
  const L = colLetter(first), R = colLetter(last);
  ws.columns = [
    { width: 20 }, { width: 14 }, { width: 10 }, { width: 34 }, { width: 11 }, { width: 11 }, { width: 7 }, { width: 3 },
    ...cols.map(() => ({ width: 10 })),
  ];
  const head = ws.addRow(["Style #", "Color", "Class", "Description", "US MSRP", "Total Units", "Size", "", ...cols.map((c) => c.code)]);
  head.font = { bold: true, name: "Arial", size: 9 };
  head.eachCell((c) => { c.border = border; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E1" } }; });
  ws.views = [{ state: "frozen", xSplit: 8, ySplit: 1 }];
  const subtotalRows: number[] = [];

  products.forEach((p) => {
    const pq = qty.get(p.id);
    const meta = ws.addRow([p.style_number, p.color, "", p.long_style_desc, p.retail_price ?? "", null, "", ""]);
    meta.font = { bold: true, name: "Arial", size: 9 };
    const sizeStart = meta.number + 1;
    SIZES.forEach((size) => {
      const vals = cols.map((c) => pq?.get(c.code)?.get(size) || null);
      const row = ws.addRow(["", "", "", "", "", null, size, "", ...vals]);
      row.getCell(6).value = { formula: `SUM(${L}${row.number}:${R}${row.number})` };
      row.font = { name: "Arial", size: 9 };
    });
    const sizeEnd = sizeStart + SIZES.length - 1;
    const sub = ws.addRow(["", "", "", "Subtotal", "", null, "", ""]);
    sub.getCell(6).value = { formula: `SUM(F${sizeStart}:F${sizeEnd})` };
    cols.forEach((_, i) => {
      const cl = colLetter(first + i);
      sub.getCell(first + i).value = { formula: `SUM(${cl}${sizeStart}:${cl}${sizeEnd})` };
    });
    sub.font = { bold: true, name: "Arial", size: 9 };
    sub.eachCell((c) => { c.border = { top: thin }; });
    meta.getCell(6).value = { formula: `F${sub.number}` };
    meta.getCell(5).numFmt = "$#,##0";
    subtotalRows.push(sub.number);
    ws.addRow([]);
  });

  const tot = ws.addRow(["", "", "", "TOTAL BY DOOR", "", null, "", ""]);
  const ref = (cl: string) => subtotalRows.map((r) => `${cl}${r}`).join(",") || "0";
  tot.getCell(6).value = { formula: `SUM(${ref("F")})` };
  cols.forEach((_, i) => {
    const cl = colLetter(first + i);
    tot.getCell(first + i).value = { formula: `SUM(${ref(cl)})` };
  });
  tot.font = { bold: true, name: "Arial", size: 10 };
  tot.eachCell((c) => { c.border = border; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E1" } }; });
  ws.headerFooter.oddHeader = `Akris ${season} — Nuorder Sizing`;
  await download(wb, filename);
}

export async function exportColorByItem(products: Product[], reviews: Review[], season: string, filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const { qty, cols } = buildQuantities(reviews);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Color by Item");
  ws.columns = [{ width: 20 }, { width: 36 }, { width: 11 }, { width: 11 }, { width: 22 }, ...cols.map(() => ({ width: 10 }))];
  const title = ws.addRow([`Akris ${season} — Color by Item`]);
  title.font = { bold: true, name: "Arial", size: 12 };
  ws.addRow([]);
  const groups = new Map<string, Product[]>();
  products.forEach((p) => {
    const k = (p.color || "Unspecified").trim();
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  [...groups.keys()].sort((a, b) => a.localeCompare(b)).forEach((color) => {
    const banner = ws.addRow([color.toUpperCase()]);
    ws.mergeCells(banner.number, 1, banner.number, 5 + cols.length);
    banner.font = { bold: true, name: "Arial", size: 11, color: { argb: "FFFFFFFF" } };
    banner.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3A3A36" } };
    const h = ws.addRow(["Style #", "Description", "US MSRP", "Total Units", "Sizes", ...cols.map((c) => c.code)]);
    h.font = { bold: true, name: "Arial", size: 9 };
    h.eachCell((c) => { c.border = border; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E1" } }; });
    groups.get(color)!.forEach((p) => {
      const pq = qty.get(p.id);
      const sizes = new Set<number>();
      pq?.forEach((d) => d.forEach((v, s) => v > 0 && sizes.add(s)));
      const doorTotals = cols.map((c) => {
        let t = 0;
        pq?.get(c.code)?.forEach((v) => (t += v));
        return t || null;
      });
      const row = ws.addRow([p.style_number, p.long_style_desc, p.retail_price ?? "", null, [...sizes].sort((a, b) => a - b).join(" "), ...doorTotals]);
      row.getCell(4).value = { formula: `SUM(${colLetter(6)}${row.number}:${colLetter(5 + cols.length)}${row.number})` };
      row.getCell(3).numFmt = "$#,##0";
      row.font = { name: "Arial", size: 9 };
    });
    ws.addRow([]);
  });
  await download(wb, filename);
}
