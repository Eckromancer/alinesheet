import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import path from "node:path";
import { buildSizingWorkbook, buildColorByItemWorkbook, dedupeReviews, allocationKey, HEADERS } from "@/lib/nuorder/build";
import { TEMPLATE_STYLES } from "@/lib/nuorder/template";

const t0 = TEMPLATE_STYLES[0]; // row 2: 7701106905008146 cerulean
const product = (o: Partial<any> = {}) => ({
  id: "p1", style_number: t0.styleNumber, color: "Cerulean", season: "Summer 2027", long_style_desc: "x",
  retail_price: 995, image_url: null, sort_order: 1, created_at: "", ...o,
});
const review = (o: Partial<any> = {}) => ({
  id: Math.random().toString(), product_id: "p1", reviewer: "A", store: "1004 Houston", decision_status: "green",
  requested_bulk_units: 2, selected_sizes: [4, 6], notes: null, special_order_notes: null, processed: false,
  processed_at: null, submission_status: "submitted", submitted_at: "2026-10-01", created_at: "", updated_at: "", ...o,
});

async function roundTrip(wb: ExcelJS.Workbook) {
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(await wb.xlsx.writeBuffer());
  return out;
}

describe("NuORDER sizing matrix", () => {
  it("matches source workbook headers, row sequence, sizes and formulas", async () => {
    const src = new ExcelJS.Workbook();
    await src.xlsx.readFile(path.resolve(__dirname, "fixtures/madison-sizing-source.xlsx"));
    const s = src.worksheets[0];
    const e = (await roundTrip(buildSizingWorkbook({ season: "Summer 2027", products: [], reviews: [] }).workbook)).getWorksheet("Sheet 1")!;
    for (let c = 1; c <= 32; c++) expect(e.getCell(1, c).value).toBe(s.getCell(1, c).value);
    expect(HEADERS).toHaveLength(32);
    for (let r = 2; r <= 541; r++) {
      for (const c of [2, 3, 4, 5, 6, 7]) expect(String(e.getCell(r, c).value ?? "")).toBe(String(s.getCell(r, c).value ?? ""));
      const sf = (s.getCell(r, 8).value as any)?.formula;
      if (sf) expect((e.getCell(r, 8).value as any)?.formula).toBe(sf);
    }
    expect(e.rowCount).toBe(541);
    expect(Object.keys((e as any)._merges).sort()).toEqual(Object.keys((s as any)._merges).sort());
  });

  it("never spreads requested units across selected sizes", async () => {
    const { workbook, issues } = buildSizingWorkbook({ season: "Summer 2027", products: [product()] as any, reviews: [review()] as any });
    const ws = (await roundTrip(workbook)).getWorksheet("Sheet 1")!;
    expect(ws.getCell("K2").value).toBe(2); // Houston header = requested units
    for (let r = 3; r <= 10; r++) expect(ws.getCell(`K${r}`).value).toBeNull();
    expect(issues.some((i) => i.type === "Awaiting buyer size allocation")).toBe(true);
  });

  it("fills sizes only from buyer-confirmed allocations", async () => {
    const allocations = new Map([[allocationKey("p1", "1004"), { 4: 1, 6: 1 }]]);
    const { workbook, issues } = buildSizingWorkbook({ season: "Summer 2027", products: [product()] as any, reviews: [review()] as any, allocations });
    const ws = (await roundTrip(workbook)).getWorksheet("Sheet 1")!;
    expect(ws.getCell("K4").value).toBe(1);
    expect(ws.getCell("K5").value).toBe(1);
    expect(issues.some((i) => i.type.startsWith("Awaiting") || i.type.startsWith("Allocation"))).toBe(false);
  });

  it("flags unmatched products, wrong season and unmapped stores", () => {
    const { issues, analysis } = buildSizingWorkbook({
      season: "Summer 2027",
      products: [product({ color: "red" }), product({ id: "p2", season: "Resort 2026" })] as any,
      reviews: [review({ store: "1020 Boston" })] as any,
    });
    expect(analysis.matched.size).toBe(0);
    expect(issues.some((i) => i.type === "Product not in sizing workbook")).toBe(true);
    expect(issues.some((i) => i.detail.startsWith("1020 Boston"))).toBe(true);
  });
});

describe("duplicate submissions", () => {
  it("keeps one review per store and style", () => {
    const { reviews, issues } = dedupeReviews([
      review({ reviewer: "A", requested_bulk_units: 3, submitted_at: "2026-10-01" }),
      review({ reviewer: "B", requested_bulk_units: 5, submitted_at: "2026-10-02" }),
    ] as any);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].requested_bulk_units).toBe(5);
    expect(issues).toHaveLength(1);
  });
  it("ignores drafts", () => {
    expect(dedupeReviews([review({ submission_status: "draft" })] as any).reviews).toHaveLength(0);
  });
});

describe("color by item", () => {
  it("creates one sheet per door with color banners", () => {
    const { workbook } = buildColorByItemWorkbook({
      season: "Summer 2027", products: [product()] as any,
      reviews: [review(), review({ store: "1019 Michigan Avenue" })] as any,
    });
    const names = workbook.worksheets.map((w) => w.name);
    expect(names).toContain("1004 Houston");
    expect(names).toContain("1019 Michigan Avenue");
    expect(workbook.getWorksheet("1004 Houston")!.getCell("A3").value).toBe("CERULEAN");
  });
});
