import ExcelJS from "exceljs";
import {
  SIZES, TEMPLATE_DOORS, STORE_TO_DOOR, lineKey, units, allocationStatus, approvedStatus,
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
  /** lineKeys with several submissions and no buyer choice — shown as ambiguous, never summed. */
  unresolvedDuplicates?: string[];
}) {
  const dupes = new Set(opts.unresolvedDuplicates ?? []);
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
  const dupeFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4B183" } };

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
      const ambiguous = store ? dupes.has(lineKey(p.id, store)) : false;
      // Submitted (incl. red or explicit 0) -> number; not reviewed -> blank; unresolved duplicate -> blank + orange.
      if (line) top.getCell(c).value = total;
      if (ambiguous) top.getCell(c).fill = dupeFill;
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
    blocking ? `DRAFT — SIZE SPLIT MISSING / NOT READY FOR NuORDER (${blocking} blocking issue${blocking > 1 ? "s" : ""}; yellow = size split needed, orange = duplicate submissions)` : "Size split complete — confirm with a NuORDER paste test before use",
    [
      "Built from submitted DSA reviews only. Top row per style = requested units per door. DSA sizes are preferences, not quantities; size cells are blank unless a buyer entered them. Nothing was split or estimated.",
      "Door cell legend: number = submitted (0 = red or explicit 0); blank = not reviewed; orange = duplicate submissions awaiting buyer choice.",
      "Class (column D) is blank — not in the source data. DSA notes and client notes are not included in this file.",
      "Door columns follow the NY sizing worksheet header (format reference only). Store-to-door matching is by store name and needs buying-office confirmation.",
      opts.sequenceNote,
    ],
  );
  return wb;
}

export async function buildColorByItemWorkbook(opts: {
  products: Product[]; lines: Line[]; issues: Issue[]; season: string; sequenceVerified: boolean; sequenceNote: string;
  /** Limit to one door (one sheet). Omit for all doors. */
  store?: string;
  /** DSA notes + client notes are private; excluded unless explicitly requested. */
  includeNotes?: boolean;
  /** "sequence" (default) keeps style order and adds a color heading only when the color changes; "color" groups by color. */
  grouping?: "sequence" | "color";
}) {
  const { products, season, includeNotes = false, grouping = "sequence" } = opts;
  const lines = opts.store ? opts.lines.filter((l) => l.store === opts.store) : opts.lines;
  const wb = new ExcelJS.Workbook();
  const seq = new Map(products.map((p, i) => [p.id, i + 1]));
  const stores = [...new Set(lines.map((l) => l.store))].sort();
  const usedNames = new Set<string>();
  for (const store of stores) {
    let name = store.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    while (usedNames.has(name)) name = name.slice(0, 28) + "_" + usedNames.size;
    usedNames.add(name);
    const ws = wb.addWorksheet(name);
    const cols = includeNotes ? [8, 20, 18, 60, 11, 11, 12, 16, 40, 40, 20] : [8, 20, 18, 60, 11, 11, 12, 16, 20];
    ws.columns = cols.map((width) => ({ width }));
    ws.addRow([`${store} — ${season} — Color by Item`]).font = { ...FONT, bold: true, size: 13 };
    const n = ws.addRow([opts.sequenceVerified ? `Style order: ${opts.sequenceNote} (buyer-supplied reference — not verified by this app)` : `Linesheet order — not verified against NuORDER. ${opts.sequenceNote}`]);
    n.font = { ...FONT, italic: true, color: { argb: opts.sequenceVerified ? "FF555555" : "FFC00000" } };
    ws.addRow([]);
    ws.addRow(includeNotes
      ? ["Seq", "Style #", "Color", "Description", "MSRP", "Decision", "Req. Units", "Preferred Sizes", "Notes", "Client-backed Notes", "DSA"]
      : ["Seq", "Style #", "Color", "Description", "MSRP", "Decision", "Req. Units", "Preferred Sizes", "DSA"]).font = { ...FONT, bold: true };
    const mine = lines.filter((l) => l.store === store).sort((a, b) => seq.get(a.product.id)! - seq.get(b.product.id)!);
    const groups: { color: string; rows: Line[] }[] = [];
    if (grouping === "color") {
      for (const l of mine) { const g = groups.find((x) => x.color === l.product.color); if (g) g.rows.push(l); else groups.push({ color: l.product.color, rows: [l] }); }
    } else {
      for (const l of mine) { const g = groups[groups.length - 1]; if (g && g.color === l.product.color) g.rows.push(l); else groups.push({ color: l.product.color, rows: [l] }); }
    }
    for (const { color, rows } of groups) {
      const h = ws.addRow([color.toUpperCase()]);
      h.font = { ...FONT, bold: true };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEAE3" } };
      ws.mergeCells(h.number, 1, h.number, cols.length);
      for (const l of rows) {
        const p = l.product, rv = l.review;
        ws.addRow([
          seq.get(p.id), p.style_number, p.color, p.long_style_desc,
          p.retail_price == null ? "" : Number(p.retail_price),
          (rv.decision_status ?? "").toUpperCase(), units(rv), rv.selected_sizes.join(" "),
          ...(includeNotes ? [rv.notes ?? "", rv.special_order_notes ?? ""] : []), rv.reviewer,
        ]).font = FONT;
      }
    }
  }
  if (!stores.length) wb.addWorksheet("No submissions").addRow(["No submitted reviews for this season."]);
  addValidationSheet(wb, opts.issues.filter((i) => i.kind === "Duplicate submission" || i.kind === "Missing MSRP")
    .filter((i) => !opts.store || i.kind !== "Duplicate submission" || i.detail.startsWith(opts.store)),
    "Color by Item export", [opts.sequenceNote, "Red decisions show 0 requested units. Preferred sizes are DSA preferences, not quantities.",
      includeNotes ? "CONTAINS PRIVATE DSA AND CLIENT NOTES — do not forward." : "DSA notes and client notes excluded."]);
  return wb;
}

/**
 * Single-door sizing sheet in the Paris worksheet shape: A:G as the NY sheet minus Total Units, H = the door.
 * Top row = buyer-approved bulk (blue); blank = not allocated. DSA request never goes in H. Sizes only from buyer entry.
 */
export async function buildDoorSizingWorkbook(opts: {
  products: Product[]; lines: Line[]; allocations: Allocations; store: string; door: string;
  sequenceNote: string; images?: Map<string, ArrayBuffer>;
}) {
  const { products, lines, allocations, store, door, images } = opts;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet 1");
  ws.columns = [23.73, 18.09, 11.27, 12.18, 18.91, 9.73, 6.54, 9.54].map((width) => ({ width }));
  ["Image", "Style #", "Color", "Class", "Style Description", "US MSRP", "Sizes", door]
    .forEach((v, i) => { const c = ws.getRow(1).getCell(i + 1); c.value = v; c.font = { ...FONT, bold: true }; });
  const byKey = new Map(lines.filter((l) => l.store === store).map((l) => [l.product.id, l]));
  const blue = { ...FONT, color: { argb: "FF0000FF" } };
  const issues: Issue[] = [];
  let r = 2;
  for (const p of products) {
    const key = lineKey(p.id, store);
    const a = allocations[key];
    const st = approvedStatus(a);
    const line = byKey.get(p.id);
    const top = ws.getRow(r);
    top.getCell(2).value = p.style_number;
    top.getCell(3).value = p.color;
    top.getCell(5).value = p.long_style_desc;
    if (p.retail_price != null) top.getCell(6).value = Number(p.retail_price);
    if (st.approved != null && st.approved > 0) { top.getCell(8).value = st.approved; top.getCell(8).font = blue; }
    SIZES.forEach((z, si) => {
      const row = ws.getRow(r + 1 + si);
      row.getCell(7).value = z;
      const q = a?.sizes[z];
      if (q) row.getCell(8).value = q;
    });
    ws.getRow(r + 9).getCell(8).value = { formula: `SUM(H${r + 1}:H${r + 8})` };
    const where = `${p.style_number} ${p.color}`;
    const req = line ? `DSA requested ${units(line.review)} (${(line.review.decision_status ?? "—").toUpperCase()})` : "not reviewed by DSA";
    if (st.state === "missing") issues.push({ kind: "Size split missing", severity: "blocking", detail: `${where}: approved ${st.approved}, sizes blank; ${req}.` });
    if (st.state === "mismatch") issues.push({ kind: "Size total mismatch", severity: "blocking", detail: `${where}: sizes ${st.sum} vs approved ${st.approved ?? "blank"}; ${req}.` });
    if (line && st.state === "unallocated" && units(line.review) > 0) issues.push({ kind: "Requested, not allocated", severity: "info", detail: `${where}: ${req}; no approved bulk entered.` });
    const img = images?.get(p.id);
    if (img) {
      const id = wb.addImage({ buffer: img as unknown as ExcelJS.Buffer, extension: "jpeg" });
      ws.addImage(id, { tl: { col: 0.1, row: r - 1 + 0.1 }, ext: { width: 120, height: 160 } });
    }
    r += 10;
  }
  ws.eachRow((row) => row.eachCell((c) => { if (!c.font?.bold && !c.font?.color) c.font = FONT; }));
  const blocking = issues.filter((i) => i.severity === "blocking").length;
  addValidationSheet(wb, issues,
    blocking ? `DRAFT — ${blocking} allocated line(s) not fully sized` : "All approved bulk is sized — confirm with a paste test before use",
    [
      `Door ${door} (${store}). Blue top number = buyer-approved bulk; blank = not allocated. DSA requested units are listed here only, never in column H.`,
      "Sizes are buyer-entered only; DSA size picks are preferences and were not used. Class (D) blank — not in source data. Notes not included.",
      opts.sequenceNote,
    ]);
  return { wb, blocking };
}
