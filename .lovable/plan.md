# Plan: Paris single-door sizing, requested vs approved bulk, order-safe color view

Source note: the Paris sizing file (AKRIS-S27-PARIS-Sizing Worksheet-MA(5).xlsx) is not in the uploads folder I can read. This plan uses the layout you described; I'll check it against the real file once it's re-attached. BG item enablement and old PO procedures are not treated as NM process.

## What exists today (checked in code)
- DSA saves one requested total (`requested_bulk_units`, red = 0) plus preferred sizes and notes. No per-size quantities, no buyer-approved number anywhere in the database.
- Buyer size boxes in Reports live only in the browser tab and are checked against the DSA request (`allocationStatus` uses `units(review)`), so "requested" and "approved" are treated as one number.
- `buildSizingWorkbook` always writes the NY 24-door layout (A:AF). There is no single-door option.
- `buildColorByItemWorkbook` groups by color (first appearance) — this reorders styles away from the linesheet / NuORDER sequence whenever a color repeats later.
- Security: reviews and client notes are still publicly readable/insertable; sign-in lock (`AUTH_REQUIRED`) is off.

## Paris target shape (from your description)
```text
A Image | B Style # | C Color | D Class | E Style Description | F US MSRP | G Sizes | H 8219-MA
Row 1 of block: style data, H = approved store bulk (e.g. 2)
Rows 2-9:       G = 2,4,6,8,10,12,14,16; H = size qty (blank = not allocated)
Row 10:         H = SUM of size rows (e.g. 2)
```
Example: 7701605200013269 red JACKET 4690 → bulk 2; size 4 = 1, size 10 = 1; subtotal 2.

## Change 1 — Approved bulk kept separately from DSA request (most important)
- New buyer-only table `buyer_allocations(product_id, store, season, approved_units, sizes jsonb, updated_by, updated_at)`; RLS via `has_role(buyer)`. Reviews untouched; DSA screens unchanged.
- `model.ts`: add `approvedUnits()`; `allocationStatus` compares size sum to approved bulk, not request. Blank approved = "not allocated" (no warning), per Madison's "no number means not allocated".
- `NuorderExports.tsx`: existing Advanced size panel, filtered to the chosen door, gets an "Approved bulk" box beside the DSA request (read-only) and saves to the table instead of the tab. No new page.

## Change 2 — Single-door Paris sizing export, reusing `buildSizingWorkbook`
- Add one builder option: `doors?: string[]` (default = all 24 NY doors, so today's file is unchanged). Columns stay A:G; door columns start at H when one door is passed, I when Total Units is kept. Add `layout: "ny" | "paris"`: Paris drops the Total Units column, so H = the door.
- Top cell H = approved bulk (blue font); blank if not allocated. DSA request never written into H; it goes in the Validation sheet only.
- Size cells only from buyer-entered sizes; row 10 = `SUM(H r+1 : H r+8)`. Nothing inferred from preferred sizes.
- Filename `sizing-8219-MA-<season>-<date>.xlsx`; DRAFT prefix while any allocated line isn't fully sized.
- Door picker already in Reports drives it; "All doors" keeps the NY file.

## Change 3 — Color-by-item keeps the original order
- Add `grouping: "sequence" | "color"` to `buildColorByItemWorkbook`, default `"sequence"`: rows in linesheet (or buyer-supplied) order, color shown in its column, a color heading inserted only when the color changes from the row above. Never moves a style. Old grouped view kept as an option.
- Order label stays "linesheet order — not verified against NuORDER".

## DSA side
No changes.

## Acceptance checks (`src/test/nuorder.test.ts`)
1. Paris export, door 8219-MA: header A1:H1 exactly Image, Style #, Color, Class, Style Description, US MSRP, Sizes, 8219-MA; no column I.
2. Red jacket fixture: request 4, approved 2, sizes 4=1, 10=1 → H top = 2, H(size 4)=1, H(size 10)=1, others blank, row 10 = SUM formula evaluating to 2.
3. Approved blank, request 3 → H top blank, all sizes blank, no blocking issue.
4. Approved 2, sizes sum 3 → mismatch; filename starts DRAFT-.
5. No size cell ever filled from `selected_sizes`; DSA request value never appears in column H.
6. "All doors" export unchanged: A:AF headers and formulas as today.
7. Color-by-item with linesheet order red, black, red → rows stay red, black, red (three headings), Seq 1-2-3.
8. RLS: signed-out and DSA cannot read/write `buyer_allocations`; buyer can.
9. Existing DSA save/submit regression still passes.
10. Open in LibreOffice: zero formula errors.

## Security before sharing with Madison (blocker)
Reviews and client notes are still public. Don't share the live portal until buyer sign-in is confirmed and the lock step runs; the new allocation table ships buyer-only from day one. For this week's deadlines, send downloaded files only.

## Out of scope
PO manager, Freshservice, dashboards, NuORDER import or compatibility claims.

## Open items
- Re-attach the Paris sizing file so the header text, blue font and widths can be matched exactly.
- Is approved bulk always Madison's own number per door/style (assumed)?
