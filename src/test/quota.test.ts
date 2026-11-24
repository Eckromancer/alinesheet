import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { adjustCount, buildQuotaSheet, countTotal, matchKey, normalizeCounts, quotaIssue, quotaState, quotaWorkflowFor, type SizeCounts } from "@/lib/quota";
import { buildQuotaSizingWorkbook } from "@/lib/nuorder/workbooks";

const fill = (quota: number, sizes: number[]) => sizes.reduce<SizeCounts>((c, z) => adjustCount(c, z, 1, quota), {});

describe("fixed allocation sizing", () => {
  it.each([1, 2, 3, 5, 6])("allocation of %i completes only when counts equal it, repeats allowed", (q) => {
    const c = fill(q, Array(q).fill(8));
    expect(c).toEqual({ "8": q });
    expect(quotaState(c, q)).toBe("complete");
    expect(quotaIssue({ quota: q }, c)).toBeNull();
  });
  it("caps at the quota (no excess via +)", () => {
    const c = fill(3, [4, 6, 8, 10]);
    expect(countTotal(c)).toBe(3);
    expect(c["10"]).toBeUndefined();
  });
  it("flags shortfall and excess", () => {
    expect(quotaIssue({ quota: 4 }, { "6": 2 })).toBe("Sizes 2 of 4 chosen");
    expect(quotaState({ "6": 5 }, 4)).toBe("excess");
    expect(quotaIssue({ quota: 4 }, { "6": 5 })).toMatch(/exceed/);
  });
  it("missing quota is not zero and not required", () => {
    expect(quotaState({}, null)).toBe("missing_quota");
    expect(quotaIssue({ quota: null }, {})).toBeNull();
    expect(adjustCount({}, 6, 1, null)).toEqual({});
  });
  it("never goes below zero; drops invalid sizes on resume", () => {
    expect(adjustCount({}, 6, -1, 3)).toEqual({});
    expect(normalizeCounts({ "6": 2, "7": 1, "8": -1, "10": 1.5, "12": 1 })).toEqual({ "6": 2, "12": 1 });
  });
  it("only Pre-Fall 2027 Michigan Avenue uses the fixed workflow", () => {
    expect(quotaWorkflowFor("Pre-Fall 2027", "1019 Michigan Avenue")?.door).toBe("8219-MA");
    expect(quotaWorkflowFor("Summer 2027", "1019 Michigan Avenue")).toBeNull();
    expect(quotaWorkflowFor("Pre-Fall 2027", "1012 San Francisco")).toBeNull();
  });
  it("matches by style + color, not style alone", () => {
    expect(matchKey(" 2701611510013269 ", "Indigo")).not.toBe(matchKey("2701611510013269", "butter yellow"));
    expect(matchKey(" 2701611510013269 ", "Indigo ")).toBe(matchKey("2701611510013269", "indigo"));
  });
});

describe("8219-MA export", () => {
  const products = [
    { id: "a", style_number: "S1", color: "butter yellow", long_style_desc: "Dress", retail_price: 1990, image_url: null },
    { id: "b", style_number: "S1", color: "indigo", long_style_desc: "Dress", retail_price: 1990, image_url: null },
  ];
  const rows = [
    { style_number: "S1", color: "indigo", product_id: "b", quota: 3, source_seq: 2 },
    { style_number: "S1", color: "butter yellow", product_id: "a", quota: null, source_seq: 1 },
    { style_number: "S9", color: "black", product_id: null, quota: 2, source_seq: 3 },
  ];
  it("keeps source order, blank quota stays blank, unlinked never sized, drafts not used", () => {
    const s = buildQuotaSheet(rows, products, new Map());
    expect(s.lines.map((l) => `${l.style} ${l.color}`)).toEqual(["S1 butter yellow", "S1 indigo", "S9 black"]);
    expect(s.lines.map((l) => l.state)).toEqual(["missing_quota", "not_submitted", "unlinked"]);
    expect(s.isDraft).toBe(true);
  });
  it("writes A:G with quota header, submitted counts and SUM subtotal", async () => {
    const s = buildQuotaSheet(rows.slice(0, 2), products, new Map([["b", { "4": 1, "8": 2 }]]));
    expect(s.lines[1].state).toBe("complete");
    const { wb } = await buildQuotaSizingWorkbook({ sheet: s, door: "8219-MA", store: "1019 Michigan Avenue", season: "Pre-Fall 2027" });
    const buf = await wb.xlsx.writeBuffer();
    const rb = new ExcelJS.Workbook(); await rb.xlsx.load(buf as ArrayBuffer);
    const ws = rb.getWorksheet("Sheet 1")!;
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(["Image", "Style #", "Color", "Style Description", "US MSRP", "Sizes", "8219-MA"]);
    expect(ws.getCell("G2").value).toBeNull(); // blank quota, not 0
    expect(ws.getCell("G12").value).toBe(3);
    expect(ws.getCell("G14").value).toBe(1); // size 4
    expect(ws.getCell("G16").value).toBe(2); // size 8
    expect(ws.getCell("G13").value).toBeNull(); // size 2 not invented
    expect((ws.getCell("G21").value as { formula: string }).formula).toBe("SUM(G13:G20)");
    expect(s.isDraft).toBe(true); // butter yellow allocation missing keeps it DRAFT
  });
});
