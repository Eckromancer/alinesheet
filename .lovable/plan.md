# Audit: smallest export change that actually saves Madison time

Audit only. No code, data, UI or settings were changed.

## What the data actually holds (checked in source)

- For each style and store, a DSA saves: decision (green/yellow/red), **one total unit count (1–10)**, a **list of preferred sizes** (2–16, no quantity per size), notes and client notes.
- **No quantity per size is stored anywhere.** "3 units, sizes 6/8" can't be split without guessing.
- Product order in the app is `sort_order`, which is the **order of the imported Summer 2027 linesheet PDF**. Nothing in the app shows this is the official NuORDER collection order. It should be called "linesheet order", not "NuORDER order".

## What is built now (Reports > 03 NuORDER Exports)

| Piece | Verdict |
|---|---|
| Color-by-item workbook, one tab for each store, grouped by color | Keep the layout. Make it **one store at a time** |
| "Official style sequence" paste box | **Hide.** It's setup work she didn't ask for, and she has no doc to paste from |
| Duplicate-submission picker | Keep, but show it only when duplicates exist (it already does) |
| Size-entry boxes for each line, kept only while the tab is open | **Remove from the main flow.** This is the same re-keying, just moved into the app, and it's lost when the tab closes |
| Sizing worksheet (NY template layout, door columns, sums) | Keep the layout. Fill in only the numbers that already exist (see Option B2) |

## Alternatives compared (one door, about 40 Summer 2027 styles)

**A. Current build**
Steps for Madison: open Reports, (optionally paste a sequence), open each line and type quantities for each size, then export.
Time saved: color view yes. Sizing: none. She types the same numbers, just in the app instead of NuORDER, and they're lost on refresh. **Net: likely slower.**

**B. Smallest pilot (recommended)**
1. Color by item: Reports, pick store, **Download**. That's 2 clicks, with no setup and no sequence. The file has one sheet for that door: a color header with styles listed under it in linesheet order, showing decision, units, preferred sizes, notes and DSA. This replaces opening each store's worksheet and re-sorting it by color.
2. Sizing: the same template, filled automatically with what truly exists: style #, color, description, MSRP, **total units for each door**, and the formulas. Size rows stay **blank**. Each door cell gets a short note with the DSA's preferred sizes (for example "pref 6/8"). No editor and no required entry.
   Time saved: she stops building the header block, door totals and style rows by hand. She still decides the size split, which is a buying decision the app can't make.

**C. Sizing filled from an existing workbook**
If Madison already keeps a sizing workbook with real quantities for each size, the app could read it and output the exact template. But if that workbook exists, it **already is** the NuORDER paste source. Re-exporting it saves almost nothing. Reject unless she says otherwise.

## Can a sizing matrix be filled with zero re-keying?

Only where the split follows directly from the data:
- **Exact:** total = 0 or red, which means an empty column.
- **Exact only if Madison agrees:** a single preferred size, so all units go to that size (for example 2 units with size 8 gives 2 in size 8). This is a rule she has to confirm. Without that, leave it blank.
- **Never filled:** more than one preferred size. Show "pref 6/8 · 3u" as a note and leave the cell blank and highlighted.

Real quantities for every size would have to come from either the DSA (a DSA screen change, which is out of scope) or Madison's own sizing doc (Option C).

## Recommendation

Run Option B for **one door** (for example 1019 Michigan Avenue, Summer 2027):
- Add a store picker and a single "Color by Item" download for that door.
- Sizing export fills the header and door totals automatically, leaves size rows blank, and adds preferred-size notes. The manual size editor is hidden.
- Hide the sequence paste box. Label the order "linesheet order (not verified against NuORDER)".
- No change to DSA screens, saved reviews, seasons or products.

Madison's extra steps: pick store, click download. What it removes: re-sorting each door's worksheet by color, and building the sizing header and totals rows by hand.

## The one question that matters

"When a DSA picks a single size, may we put all of that door's units in that size? Or should every size split stay with you?"
Her answer decides whether the sizing file pre-fills those cells or leaves them blank. Everything else can ship without waiting.

## Technical notes (for build phase)

- UI change only, in `src/components/reports/NuorderExports.tsx`: add a store `Select`. Remove the `Textarea` sequence input and the allocation editor from the render, keeping the pure functions in `src/lib/nuorder/model.ts`.
- `buildColorByItemWorkbook`: add a `store` filter so the file has one sheet.
- `buildSizingWorkbook`: fill door totals from `units(review)`, add cell comments with `selected_sizes`, and leave size cells empty unless the single-size rule is approved.
- Update `src/test/nuorder.test.ts`: the one-store export includes only that store, and multi-size lines produce no per-size numbers.
