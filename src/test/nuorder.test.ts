import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import ExcelJS from "exceljs";
import { orderProducts, resolveLines, validate, allocationStatus, lineKey, TEMPLATE_DOORS, type Product, type Review } from "@/lib/nuorder/model";
import { buildSizingWorkbook, buildColorByItemWorkbook } from "@/lib/nuorder/workbooks";

const prod = (id: string, style: string, color: string, sort: number, price: number | null = 1000): Product =>
  ({ id, style_number: style, color, sort_order: sort, long_style_desc: `desc ${id}`, retail_price: price, image_url: null, season: "Summer 2027", created_at: "" });
const rev = (id: string, pid: string, store: string, reviewer: string, u: number | null, sizes: number[], d: Review["decision_status"] = "green", status: Review["submission_status"] = "submitted"): Review =>
  ({ id, product_id: pid, store, reviewer, requested_bulk_units: u, selected_sizes: sizes, decision_status: d, submission_status: status,
     notes: null, special_order_notes: null, processed: false, processed_at: null, created_at: "", updated_at: "", submitted_at: "" });

const P = [prod("a", "7701000000000001", "black", 2), prod("b", "7701000000000001", "ecru", 1), prod("c", "7701000000000003", "black", 3, null)];
const R = [
  rev("r1", "a", "1019 Michigan Avenue", "Liz", 3, [6, 8]),
  rev("r2", "a", "1002 Northpark", "Lisa", 2, [4]),
  rev("r3", "b", "1019 Michigan Avenue", "Liz", 0, [], "red"),
  rev("r4", "b", "1002 Northpark", "Lisa", 1, [6]),
  rev("r5", "b", "1002 Northpark", "Temp", 4, [8]),
  rev("r6", "a", "1020 Boston", "Lisa P", 2, []),
  rev("r7", "c", "1019 Michigan Avenue", "Liz", 5, [10], "green", "draft"),
  { ...rev("r8", "c", "1002 Northpark", "Lisa", 0, [12]), notes: "PRIVATE-DSA-NOTE", special_order_notes: "Mrs CLIENTNAME wants 12" },
];
const cellText = (wb: ExcelJS.Workbook) => { const out: string[] = []; wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => out.push(String((c.value as { formula?: string })?.formula ?? c.value))))); return out.join("|"); };

describe("NuORDER exports", () => {
  it("orders by sort_order unverified, and by exact style+color when imported", () => {
    expect(orderProducts(P, null).ordered.map((p) => p.id)).toEqual(["b", "a", "c"]);
    const s = orderProducts(P, ["7701000000000003", "7701000000000001 black", "7701000000000001 ecru"]);
    expect(s.verified).toBe(true);
    expect(s.ordered.map((p) => p.id)).toEqual(["c", "a", "b"]);
    // style # alone is ambiguous (two colors) -> not matched
    expect(orderProducts(P, ["7701000000000001"]).unmatched).toEqual(["7701000000000001"]);
  });

  it("ignores drafts, never sums duplicates, uses only the buyer-chosen review", () => {
    const none = resolveLines(P, R, {});
    expect(none.lines.find((l) => l.review.id === "r7")).toBeUndefined();
    expect(none.duplicates).toHaveLength(1);
    expect(none.lines.some((l) => l.product.id === "b" && l.store === "1002 Northpark")).toBe(false);
    const chosen = resolveLines(P, R, { [lineKey("b", "1002 Northpark")]: "r5" });
    const l = chosen.lines.find((x) => x.product.id === "b" && x.store === "1002 Northpark")!;
    expect(allocationStatus(l, undefined).total).toBe(4);
  });

  it("requires exact size totals or explicit buyer approval", () => {
    const line = resolveLines(P, R, {}).lines.find((l) => l.review.id === "r1")!;
    expect(allocationStatus(line, undefined).state).toBe("missing");
    expect(allocationStatus(line, { sizes: { 6: 1, 8: 1 } }).state).toBe("mismatch");
    expect(allocationStatus(line, { sizes: { 6: 1, 8: 1 }, acceptMismatch: true }).state).toBe("accepted");
    expect(allocationStatus(line, { sizes: { 6: 2, 8: 1 } }).state).toBe("ok");
  });

  it("flags unmatched door, missing sizes, duplicate; writes fixture workbooks", async () => {
    const choices = {};
    const { lines, issues: d } = resolveLines(P, R, choices);
    const alloc = { [lineKey("a", "1019 Michigan Avenue")]: { sizes: { 6: 2, 8: 1 } }, [lineKey("a", "1002 Northpark")]: { sizes: { 4: 2 } } };
    const issues = [...d, ...validate(orderProducts(P, null).ordered, lines, alloc, ["1020 Boston", "1001 Downtown"])];
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain("Duplicate submission");
    expect(kinds).toContain("Unmatched door");
    expect(kinds).toContain("Missing MSRP");
    expect(kinds).toContain("No size preference from DSA");
    expect(issues.find((i) => i.kind === "Unmatched door" && i.detail.startsWith("1020"))!.severity).toBe("blocking");
    expect(TEMPLATE_DOORS).toHaveLength(24);
    const ordered = orderProducts(P, null).ordered;
    const s = await buildSizingWorkbook({ products: ordered, lines, allocations: alloc, issues, sequenceNote: "provisional" });
    writeFileSync("/tmp/fixture-sizing.xlsx", Buffer.from(await s.xlsx.writeBuffer()));
    const c = await buildColorByItemWorkbook({ products: ordered, lines, issues, season: "Summer 2027", sequenceVerified: false, sequenceNote: "provisional" });
    writeFileSync("/tmp/fixture-color.xlsx", Buffer.from(await c.xlsx.writeBuffer()));
  });

  it("color by item: one door only, notes excluded by default, linesheet order labelled unverified", async () => {
    const { lines, issues } = resolveLines(P, R, {});
    const ordered = orderProducts(P, null).ordered;
    const wb = await buildColorByItemWorkbook({ products: ordered, lines, issues, season: "Summer 2027", sequenceVerified: false, sequenceNote: "x", store: "1002 Northpark" });
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(["1002 Northpark", "Validation"]);
    const txt = cellText(wb);
    expect(txt).not.toContain("CLIENTNAME");
    expect(txt).not.toContain("PRIVATE-DSA-NOTE");
    expect(txt).not.toContain("Michigan");
    expect(txt).toContain("not verified against NuORDER");
    const withNotes = cellText(await buildColorByItemWorkbook({ products: ordered, lines, issues, season: "S", sequenceVerified: false, sequenceNote: "x", store: "1002 Northpark", includeNotes: true }));
    expect(withNotes).toContain("CLIENTNAME");
    const all = await buildColorByItemWorkbook({ products: ordered, lines, issues, season: "S", sequenceVerified: false, sequenceNote: "x" });
    expect(all.worksheets.map((w) => w.name)).toEqual(["1002 Northpark", "1019 Michigan Avenue", "1020 Boston", "Validation"]);
  });

  it("sizing: A:AF headers, door totals, red/0 vs not reviewed, blank size cells, no notes, DRAFT", async () => {
    const { lines, duplicates, issues: d } = resolveLines(P, R, {});
    const ordered = orderProducts(P, null).ordered; // b, a, c
    const issues = [...d, ...validate(ordered, lines, {}, [])];
    expect(issues.some((i) => i.kind === "Size split missing" && i.severity === "blocking")).toBe(true);
    expect(issues.some((i) => i.kind === "Unverified door mapping")).toBe(true);
    const wb = await buildSizingWorkbook({ products: ordered, lines, allocations: {}, issues, sequenceNote: "x", unresolvedDuplicates: duplicates.map((x) => x.key) });
    const ws = wb.getWorksheet("Sheet 1")!;
    const hdr = (ws.getRow(1).values as unknown[]).slice(1);
    expect(hdr).toHaveLength(32);
    expect(hdr.slice(0, 8)).toEqual(["Image", "Style #", "Color", "Class", "Style Description", "US MSRP", "Sizes", "Total Units"]);
    expect(hdr[8]).toBe("8112-NP"); expect(hdr[31]).toBe("8073-NME");
    const col = (door: string) => 9 + TEMPLATE_DOORS.indexOf(door as never);
    // block b (rows 2-11): MA red -> 0; NP duplicate unresolved -> blank + orange
    expect(ws.getRow(2).getCell(col("8219-MA")).value).toBe(0);
    expect(ws.getRow(2).getCell(col("8112-NP")).value).toBeNull();
    expect((ws.getRow(2).getCell(col("8112-NP")).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFF4B183");
    // block a (rows 12-21): MA 3, NP 2; another door not reviewed -> blank
    expect(ws.getRow(12).getCell(col("8219-MA")).value).toBe(3);
    expect(ws.getRow(12).getCell(col("8112-NP")).value).toBe(2);
    expect(ws.getRow(12).getCell(col("8111-FW")).value).toBeNull();
    // block c (rows 22-31): draft at MA excluded -> blank; NP explicit 0 -> 0
    expect(ws.getRow(22).getCell(col("8219-MA")).value).toBeNull();
    expect(ws.getRow(22).getCell(col("8112-NP")).value).toBe(0);
    // every size cell in every door column is empty (no invented split)
    for (const top of [2, 12, 22]) for (let r = top + 1; r <= top + 8; r++) for (let c = 9; c <= 32; c++) expect(ws.getRow(r).getCell(c).value).toBeNull();
    expect(ws.getRow(12).getCell(8).value).toEqual({ formula: "SUM(I12:AF12)" });
    expect(ws.getRow(21).getCell(9).value).toEqual({ formula: "SUM(I13:I20)" });
    expect(ws.getRow(13).getCell(7).value).toBe(2); expect(ws.getRow(20).getCell(7).value).toBe(16);
    const txt = cellText(wb);
    expect(txt).not.toContain("CLIENTNAME"); expect(txt).not.toContain("PRIVATE-DSA-NOTE");
    expect(txt).toContain("DRAFT — SIZE SPLIT MISSING");
    writeFileSync("/tmp/fixture-sizing-blank.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
  });
});
