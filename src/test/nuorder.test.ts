// @vitest-environment node
import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
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
];

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
});
