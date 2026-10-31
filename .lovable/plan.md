# Audit: 3 critical improvements (buyer bulk view, allocation-constrained sizing, order fidelity)

## What exists today (checked in code)
- DSA saves one requested total (`requested_bulk_units`, 1–10, red = 0), preferred sizes, notes, client notes. No per-size quantities anywhere.
- No buyer-approved allocation is stored. The only buyer numbers are the optional size boxes in Reports, kept in the browser tab (`sessionStorage`) and lost when it closes.
- The sizing export puts the DSA's request in each door's top cell and checks sizes against that request (`allocationStatus` compares to `units(review)`). So "requested" and "approved bulk" are treated as the same number. Madison's rule is different: only the designated bulk at the top (blue) gets sized; no number means not allocated.
- Color by item: one-door download exists. Style order = linesheet import order, labelled unverified. The optional order paste box only accepts style + color text; nothing is verified against NuORDER.
- Security: reviews still publicly readable and insertable; `AUTH_REQUIRED` is off; the DSA notes box invites client names ("Hold 1 size 6 for Ms. Walker").
- Item Enablement Overview is a BG/Saks document and is not used as proof of NM process.

## Improvement 1 — Buyer bulk column, separate from DSA request (highest value)
Buyer sees one door at a time (color-by-item order) with DSA request beside an editable "Approved bulk" number. Blank = not allocated. The sizing export's blue top row uses approved bulk only; the request moves to a reference note.
- New table `buyer_allocations(product_id, store, season, approved_units, sizes jsonb, updated_by, updated_at)`, buyer-only RLS via `has_role`. Reviews are not touched; DSA screens unchanged.
- `src/lib/nuorder/model.ts`: add `approvedUnits(line, alloc)`; `allocationStatus` compares size sum to approved bulk, not request; blank approved = "not allocated", no issue raised.
- `src/components/reports/NuorderExports.tsx`: replace the tab-only size boxes with a per-door list (door picker reused) saving to the table; prefill nothing.
- `src/lib/nuorder/workbooks.ts`: top door cell = approved units with blue fill; blank when not allocated; request shown in the Validation sheet / column AG note only.

## Improvement 2 — Sizing limited to allocated bulk, never inferred
- Size cells are only enterable when approved bulk > 0; the export marks "sized" only when sizes sum to approved bulk. DRAFT label stays until every allocated line is sized. Unallocated doors produce no warnings.
- Same files as above; no auto-split from preferred sizes.

## Improvement 3 — Order fidelity from Madison's own source
- Accept an uploaded NuORDER/worksheet export (XLSX/CSV, style + color columns) in the existing Advanced box instead of free text; match exactly on style # + color; show unmatched rows. Only labelled "buyer-supplied order", never "NuORDER verified".
- `orderProducts` unchanged in logic; add a small parser in `src/lib/nuorder/sequence.ts`. Color headings keep first-appearance order from that sequence.

## DSA side
No changes to steps or taps. Only change: notes placeholder text no longer suggests client names (copy only, optional, flagged for your call).

## Acceptance tests (`src/test/nuorder.test.ts`)
1. Request 4, approved blank → top cell blank, no "size split missing" issue.
2. Request 4, approved 2, sizes 6:1 8:1 → status ok; top cell 2 with blue fill; request 4 only in notes.
3. Approved 2, sizes sum 3 → mismatch, file stays DRAFT.
4. Red review → request 0, approved stays blank unless buyer types a number.
5. No size cell ever filled from `selected_sizes`.
6. Uploaded order with 41 rows → products follow it exactly; one bad row listed as unmatched and label says "buyer-supplied".
7. RLS: signed-out and DSA cannot read/write `buyer_allocations`; buyer can.
8. Existing DSA save/submit regression still passes.

## Security before sharing with Madison (blocker)
Reviews and client notes are still public. Do not share the live portal until buyer sign-in is confirmed and the lockdown step runs. New allocation table must ship buyer-only from day one. Given tomorrow's deadline, the safe path for this week is downloaded files, not live access.

## Out of scope
PO manager, Freshservice, new dashboards, any claim of NuORDER compatibility.

## Open question
Is "approved bulk" set by Madison per door per style (assumed), or does it come from another file she already has?
