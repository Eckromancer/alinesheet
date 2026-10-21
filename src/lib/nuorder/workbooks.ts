import ExcelJS from "exceljs";
import {
  SIZES, TEMPLATE_DOORS, STORE_TO_DOOR, lineKey, units, allocationStatus,
  type Allocations, type Issue, type Line, type Product,
} from "./model";

const FONT = { name: "Calibri", size: 11 } as const;
const colLetter = (n: number) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const FIRST_DOOR = 9; // I
const LAST_DOOR = FIRST_DOOR + TEMPLATE_DOORS.length - 1; // AF
const I = colLetter(FIRST_DOOR), AF = colLetter(LAST_DOOR);

function addValidationSheet(wb: ExcelJS.Workbook, issues: Issue[], status: string, notes: string[]) {
  const ws = wb.addWorksheet("Validation");
  ws.columns = [{ width: 12 }, { width: 34 }, { width: 110 }];
  ws.addRow(["Status", status]).font = { ...FONT, bold: true };
  notes.forEach((n) => ws.addRow(["Note", n]));
  ws.addRow([]);
  ws.addRow(["Severity", "Issue", "Detail"]).font = { ...FONT, bold: true };
  if (!issues.length) ws.addRow(["—", "No issues", ""]);
  issues.forEach((i) => {
    const r = ws.addRow([i.severity.toUpperCase(), i.kind, i.detail]);
    if (i.severity === "blocking") r.getCell(1).font = { ...FONT, bold: true, color: { argb: "FFC00000" } };
  });
}

export async function buildSizingWorkbook(opts: {
  products: Product[]; lines: Line[]; allocations: Allocations; issues: Issue[];
  sequenceNote: string; images?: Map<string, ArrayBuffer>;
}) {
  const { products, lines, allocations, issues, images } = opts;
  const blocking = issues.filter((i) => i.severity === "blocking").length;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet 1");
  const widths = [23.73, 18.09, 11.27, 12.18, 18.91, 9.73, 6.54, 9.54];
  ws.columns = [...widths, ...TEMPLATE_DOORS.map(() => 8.73)].map((width) => ({ width }));
  const header = ws.getRow(1);
  ["Image", "Style #", "Color", "Class", "Style Description", "US MSRP", "Sizes", "Total Units", ...TEMPLATE_DOORS]
    .forEach((v, i) => { header.getCell(i + 1).value = v; header.getCell(i + 1).font = { ...FONT, bold: true }; });

  const byKey = new Map(lines.map((l) => [lineKey(l.product.id, l.store), l]));
  const doorStore = new Map(Object.entries(STORE_TO_DOOR).map(([s, d]) => [d, s]));
  const missingFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

  let r = 2;
  for (const p of products) {
    const top = ws.getRow(r);
    top.getCell(2).value = p.style_number;
    top.getCell(3).value = p.color;
    top.getCell(5).value = p.long_style_desc;
    if (p.retail_price != null) top.getCell(6).value = Number(p.retail_price);
    top.getCell(8).value = { formula: `SUM(${I}${r}:${AF}${r})` };
    TEMPLATE_DOORS.forEach((door, di) => {
      const c = FIRST_DOOR + di;
      const store = doorStore.get(door);
      const line = store ? byKey.get(lineKey(p.id, store)) : undefined;
      const a = line ? allocations[lineKey(p.id, store!)] : undefined;
      const st = line ? allocationStatus(line, a) : null;
      const total = st ? (st.state === "accepted" ? st.sum : st.total) : 0;
      if (total > 0) top.getCell(c).value = total;
      SIZES.forEach((z, si) => {
        const cell = ws.getRow(r + 1 + si).getCell(c);
        const q = a?.sizes[z];
        if (q) cell.value = q;
        if (st && (st.state === "missing" || st.state === "mismatch")) cell.fill = missingFill;
      });
      ws.getRow(r + 9).getCell(c).value = { formula: `SUM(${colLetter(c)}${r + 1}:${colLetter(c)}${r + 8})` };
    });
    SIZES.forEach((z, si) => {
      const row = ws.getRow(r + 1 + si);
      row.getCell(7).value = z;
      row.getCell(8).value = { formula: `SUM(${I}${r + 1 + si}:${AF}${r + 1 + si})` };
    });
    ws.getRow(r + 9).getCell(8).value = { formula: `SUM(H${r + 1}:H${r + 8})` };
    const img = images?.get(p.id);
    if (img) {
      const id = wb.addImage({ buffer: img as unknown as ExcelJS.Buffer, extension: "jpeg" });
      ws.addImage(id, { tl: { col: 0.1, row: r - 1 + 0.1 }, ext: { width: 120, height: 160 } });
    }
    r += 10;
  }
  ws.eachRow((row) => row.eachCell((c) => { if (!c.font?.bold) c.font = FONT; }));

  addValidationSheet(
    wb, issues,
    blocking ? `DRAFT — NOT READY FOR NuORDER (${blocking} blocking issue${blocking > 1 ? "s" : ""}; yellow cells need size allocation)` : "Allocations complete — confirm with a NuORDER paste test before use",
    [
      "Built from submitted DSA reviews only. Per-size quantities are buyer-entered; nothing was split or estimated.",
      "Door columns follow the NY sizing worksheet header (format reference only). Store-to-door matching is by store name and needs buying-office confirmation.",
      opts.sequenceNote,
    ],
  );
  return wb;
}

export async function buildColorByItemWorkbook(opts: {
  products: Product[]; lines: Line[]; issues: Issue[]; season: string; sequenceVerified: boolean; sequenceNote: string;
}) {
  const { products, lines, season } = opts;
  const wb = new ExcelJS.Workbook();
  const seq = new Map(products.map((p, i) => [p.id, i + 1]));
  const stores = [...new Set(lines.map((l) => l.store))].sort();
  const usedNames = new Set<string>();
  for (const store of stores) {
    let name = store.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    while (usedNames.has(name)) name = name.slice(0, 28) + "_" + usedNames.size;
    usedNames.add(name);
    const ws = wb.addWorksheet(name);
    ws.columns = [8, 20, 18, 60, 11, 11, 12, 16, 40, 40, 20].map((width) => ({ width }));
    ws.addRow([`${store} — ${season} — Color by Item`]).font = { ...FONT, bold: true, size: 13 };
    const n = ws.addRow([opts.sequenceVerified ? `Style order: ${opts.sequenceNote}` : `SEQUENCE UNVERIFIED — ${opts.sequenceNote}`]);
    n.font = { ...FONT, italic: true, color: { argb: opts.sequenceVerified ? "FF555555" : "FFC00000" } };
    ws.addRow([]);
    ws.addRow(["Seq", "Style #", "Color", "Description", "MSRP", "Decision", "Req. Units", "Preferred Sizes", "Notes", "Client-backed Notes", "DSA"]).font = { ...FONT, bold: true };
    const mine = lines.filter((l) => l.store === store).sort((a, b) => seq.get(a.product.id)! - seq.get(b.product.id)!);
    const colors: string[] = [];
    mine.forEach((l) => { if (!colors.includes(l.product.color)) colors.push(l.product.color); });
    for (const color of colors) {
      const h = ws.addRow([color.toUpperCase()]);
      h.font = { ...FONT, bold: true };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEAE3" } };
      ws.mergeCells(h.number, 1, h.number, 11);
      for (const l of mine.filter((m) => m.product.color === color)) {
        const p = l.product, rv = l.review;
        ws.addRow([
          seq.get(p.id), p.style_number, p.color, p.long_style_desc,
          p.retail_price == null ? "" : Number(p.retail_price),
          (rv.decision_status ?? "").toUpperCase(), units(rv), rv.selected_sizes.join(" "),
          rv.notes ?? "", rv.special_order_notes ?? "", rv.reviewer,
        ]).font = FONT;
      }
    }
  }
  if (!stores.length) wb.addWorksheet("No submissions").addRow(["No submitted reviews for this season."]);
  addValidationSheet(wb, opts.issues.filter((i) => i.kind === "Duplicate submission" || i.kind === "Missing MSRP"),
    "Color by Item export", [opts.sequenceNote, "Red decisions show 0 requested units."]);
  return wb;
}
