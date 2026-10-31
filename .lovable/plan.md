# Corrected plan: Paris single-door sizing, approved vs requested bulk, order-safe color view

## Source file status
- The real Paris sizing file (AKRIS-S27-PARIS-Sizing Worksheet-MA(5).xlsx) is available to you and was opened independently. Lovable could not read its bytes: only the Paris DSA Color Worksheet PDF is in this chat's uploads. You don't need to re-attach it. The facts below come from your verified read.
- Verified layout: A1:H1 = Image | Style # | Color | Class | Style Description | US MSRP | Sizes | 8219-MA. Row 2 = style 7701605200013269, red, JACKET, Naima jacket, 4690, H2 = 2 (approved bulk). G3:G10 = 2,4,6,8,10,12,14,16. H4 = 1 (size 4), H7 = 1 (size 10). H11 = 2. The next style starts at row 12, so each block is 10 rows.
- **Still unknown: is H11 a SUM formula or a typed 2?** Lovable hasn't checked this. The NY worksheet audit found many typed subtotals, so neither answer can be assumed.

## Correction to the earlier draft
The first draft of this export already exists but has not been signed off: `buildDoorSizingWorkbook`, the `buyer_allocations` table (migration 0003) and `grouping` on color-by-item. It writes `=SUM(H3:H10)` in the subtotal row. That counts as an **improvement**, not an exact copy of the source, until H11 is confirmed.
- Default: keep the SUM formula. Its value matches a typed subtotal whenever the sizes are right, and it shows mismatches right away.
- Optional: an "exact source" switch writes the typed number instead. Add it only if you confirm H11 is typed and Madison wants the file to match exactly.
- Either way, the Validation sheet says which mode was used.

## Scope (minimal, export module only)
1. **DSA side:** no changes to screens, autosave, submission or email.
2. **Approved bulk kept separate:** `buyer_allocations` (product, store, season, approved_units, sizes) is buyer-only through RLS `has_role(buyer)`. The DSA's `requested_bulk_units` is never overwritten. In Reports, the existing Advanced panel shows the request read-only and the approved bulk and sizes as editable, saved per door.
3. **Paris one-door file:** reproduces A:H exactly, in 10-row blocks starting at row 2.
   - H top = approved bulk, in blue. Blank means not allocated.
   - Size rows hold only sizes the buyer entered. DSA preferred sizes are never used.
   - The DSA request appears only on the Validation sheet.
   - Filename: `sizing-<door>-<season>-<date>.xlsx`, with a `DRAFT-` prefix while any allocated line is unsized or mismatched.
4. **NY multi-door file:** unchanged (A:AF).
5. **Color by item:** keeps the original style order by default (`grouping: "sequence"`). A color heading appears only when the color changes, and no style is ever moved. Labelled "linesheet order — not verified against NuORDER".
6. **Warnings:** blocking issues "Size split missing" and "Size total mismatch". Info note "Requested, not allocated". Never presented as NuORDER-ready.
7. **Copy-friendly:** plain values, no merged cells in A:H, Calibri 11 with only H top in blue. The pilot is one style typed or pasted into Madison's current NuORDER workflow. **No direct import claim.**

## Security warning (blocks sharing)
- The `reviews` table still allows public SELECT/INSERT, including client notes.
- `AUTH_REQUIRED = false`, and `supabase/staged/lockdown.sql` hasn't been applied.
- `buyer_allocations` is buyer-only from the start, but the live portal must not go to Madison until buyer sign-in is checked and the lock runs. Until then, share downloaded files only.

## Acceptance tests (`src/test/nuorder.test.ts` + manual)
1. Paris export for 8219-MA: A1:H1 match the verified header exactly, and there is no column I.
2. Fixture red Naima jacket (request 4, approved 2, size 4 = 1, size 10 = 1): H2 = 2 in blue, G3:G10 = 2–16, H4 = 1, H7 = 1, all other H3:H10 blank, H11 = 2. The next style starts at row 12.
3. Subtotal mode: the default H11 is the formula `SUM(H3:H10)` and evaluates to 2 in LibreOffice. Exact mode (only if built) writes the number 2 with no formula.
4. Approved blank, request 3: H top blank, sizes blank, no blocking issue, info note present.
5. Approved 2 with sizes summing to 3: mismatch is blocking and the filename starts with `DRAFT-`.
6. No size cell is ever filled from DSA preferred sizes, and the DSA request value never appears in column H.
7. NY "All doors" export: A:AF headers and formulas unchanged.
8. Color by item with order red, black, red: rows stay red, black, red with three headings and Seq 1-2-3.
9. RLS: signed-out users and DSAs cannot read or write `buyer_allocations`; a buyer can.
10. The DSA save/submit regression still passes, and the review row's requested units are unchanged after a buyer saves an allocation.
11. LibreOffice open shows zero formula errors.
12. Manual: Madison enters one style from the file into her current NuORDER workflow without fixing anything. Recorded as pass/fail; not an import test.

## Open items
- Confirm whether H11 in the real file is a formula or a typed value. This decides if exact mode is needed.
- Is approved bulk always Madison's own number per door and style? (assumed)
- Store-to-door codes (e.g. 8219-MA) still need buying-office confirmation.

## Out of scope
PO manager, Freshservice, dashboards, NuORDER import, changes to the DSA form.
