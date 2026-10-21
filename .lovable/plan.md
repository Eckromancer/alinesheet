# Audit: Color by Item and Nuorder Sizing Matrix exports

Audit only. Nothing below has been changed yet. The fixes in section 3 need your approval first.

## 1. Findings (checked against the code, the live data and Madison's workbook)

| # | Issue | What the code does today | Verdict |
|---|---|---|---|
| 1 | Size quantities | The review page saves one quantity (1–10) and a set of sizes. The export then splits that quantity evenly across the sizes (5 units in sizes 6 and 8 becomes 6:3, 8:2). | Confirmed. Every per-size number in the export is made up by the app, not entered by a DSA. |
| 2 | Duplicate submissions | The database allows only one review per product + reviewer + store. Two different reviewers at the same store can both submit, and the export adds their numbers together. Live data today: 82 submitted reviews and no store with two submissions for the same product. | Confirmed as a risk. It is not happening in the data yet. |
| 3 | Red / no-demand styles | Red reviews are left out of the quantities, but `exportSizingMatrix` still writes a block for every product in the season, including empty ones. Color by Item does the same. | Confirmed. What I said last time ("red styles are left out") was only true for the quantities, not the rows. |
| 4 | Door columns | The 24 template doors are in the right order. 8224-PA and 8073-NME never get data. Downtown and Boston are added as extra columns after the template doors. | Confirmed. The extra columns change the template's width and move the SUM ranges, so this does not match the template. |
| 5 | Class | The product data has no Class field, so that column is blank. The template does have Class filled in (e.g. "SHIRT TOP"). | Confirmed. |
| 6 | Layout vs template | **The template is not matched.** Template columns are A Image, B Style #, C Color, D Class, E Description, F MSRP, G Sizes, H Total Units, I–AF doors. The export uses A Style #, B Color, C Class, D Description, E MSRP, F Total Units, G Size, H blank. Every column from A to H is off by one. The template also has no blank row between style blocks, and the export adds one. | Confirmed bug. Pasting into Nuorder or the template would put data in the wrong columns. Nobody has tested a paste into Nuorder. |
| 7 | Zero vs blank | The export writes blank for both "nothing entered" and 0. The template uses blank for no units. The template's sizes (2–16, one row per size) match the app's. | Mostly fine. Only one rule needs agreeing (see questions). |
| 8 | Template safety | The export builds a new file from scratch. Madison's uploaded workbook is never opened or changed. | Fine. Keep it that way. |

## 2. Assumptions (not checked yet)
- Nuorder accepts a straight copy of door × size cells from a workbook laid out like Madison's. We only have her worksheet, not the Nuorder import screen.
- Class can be taken from Madison's sizing worksheet by matching Style # + Color.

## 3. Proposed fixes (smallest set)

**A. Enter a quantity for each size (fixes 1 and 7).**
- The DSA screen keeps its look: the same green, yellow and red buttons and the same size buttons. When a DSA picks a size, a small 0–10 quantity picker appears under that size. The overall quantity becomes the sum of the per-size quantities and is shown read-only.
- A new review field stores the quantity for each size (for example `{"6":2,"8":1}`).
- Exports use only the per-size quantities. For old reviews that only have one overall quantity, the export does not guess. It marks the style "needs sizing" in a separate review list and leaves its cells blank.
- Blank means not requested. A 0 entered on purpose is written as 0.

**B. One count per product and store (fixes 2).**
- Before exporting, check for more than one submission for the same product + store. If there are any, stop and show a list of the conflicts on the Reports page with the choice "use the latest" or "use one reviewer". Numbers are never added together without someone choosing.
- No change to the database rule that allows one review per reviewer, so the DSA experience stays the same.

**C. Rows (fixes 3).** Only include styles that have at least one non-red submitted review with quantities. An optional "include all styles" switch keeps the full line list when Madison wants it.

**D. Exact door columns (fixes 4).** Always use exactly the 24 template doors (I–AF), with no extra columns. Downtown and Boston (and 8224-PA / 8073-NME) need a mapping from you. Until then, their units appear in an "Unmapped doors" list on a second sheet and are never placed in the main grid.

**E. Copy the template layout exactly (fixes 5 and 6).**
- Columns A–H in the same order as the template: Image (blank), Style #, Color, Class, Style Description, US MSRP, Sizes, Total Units.
- No blank rows between styles.
- Formulas like the template: size row `H=SUM(I:AF)`, subtotal row `=SUM(H3:H10)` and the same for each door, and a total-by-door row at the bottom.
- Class: add an optional class field to products and fill it once for Summer 2027 from Madison's worksheet by matching Style # + Color. Styles with no match stay blank and are listed.

**F. Color by Item.** Same row filter (C), door columns (D) and per-size data (A). The layout stays as it is.

## 4. Data migration and validation plan
1. Add the per-size quantities field to reviews (empty by default) and an optional class field to products. Existing data is not rewritten.
2. Fill in class for Summer 2027 by matching Style # + Color against Madison's worksheet (read only). Report the match rate before saving.
3. Leave old reviews as they are, with no automatic split. List them as "needs sizing" so DSAs or the buyer can fill in per-size numbers.
4. Validation script: check that per-size totals add up to the overall total, list duplicates per product + store, and list any stores outside the 24 template doors.

## 5. Acceptance test (automated, test data only)
Test data: doors 8219-MA (Michigan Avenue) and 8112-NP (Northpark); style S1/cerulean and style S2/stone.
- MA, reviewer A, S1 green: sizes 6:2, 8:1 → MA column, S1 rows 6=2 and 8=1, subtotal 3.
- NP, reviewer B, S1 yellow: size 10:0 entered on purpose → cell shows 0, not blank.
- MA, reviewer A, S2 red with sizes → S2 does not appear (only if no other non-red review exists for it).
- NP, reviewer B, S2 green: 4:1, 6:1, 8:2.
- NP, reviewer C (duplicate), S2 green: 4:3 → export is blocked and the S2 + NP conflict is listed. After choosing "latest", only reviewer C's numbers are used. They are never added to reviewer B's.

Checks:
- Header row is exactly A–H plus the 24 doors, in template order.
- Formulas are correct.
- Total by door: MA = 3, NP = 0 + chosen S2 numbers.
- No columns beyond AF.
- Madison's original file is unchanged (compare file hashes before and after).

Manual check: open the file in Excel and paste one style block into Madison's template and into Nuorder.

## Blocking questions
1. **Downtown (1001) and Boston (1020):** are they the same as 8224-PA and 8073-NME, some other Nuorder door, or should they be left out?
2. **Old reviews with only an overall quantity:** should they be shown as "needs sizing" and left blank (recommended), or split evenly with a warning on the sheet?
3. **Duplicates:** when two reviewers at one store disagree, is "latest submission wins" the right default?
