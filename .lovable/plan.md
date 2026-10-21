# Audit: sizing export vs. the real NY sizing worksheet

Audit only. No code, data, UI or settings were changed. The file checked is the uploaded `AKRIS-S27-NY-NM-SIZING_WORKSHEET.xlsx`. Only the Excel version is in uploads; I couldn't find a 5-page PDF, so the same template is assumed. It's used as a **format reference only**. Its 54 NY styles are never loaded as Paris products.

## Do the two new files change the recommendation? No.

- **Paris color worksheet (the 41 Excel rows):** this matches the 41 Summer 2027 products already in the app. It's the blank form DSAs fill in. It has one "Requested Bulk Units" box and a notes box for each style, and **no size columns**. The DSA form follows the same design: one total plus a list of preferred sizes. So **the Paris file can't supply size quantities**, because they were never part of it. It also doesn't prove the NuORDER order; its row order is just the linesheet order.
- **NY sizing worksheet:** this is a layout to copy, not product data, as covered below.
- **Smallest practical source for exact sizes:** Madison's own size split, typed directly into the exported sizing file. Today she types sizes into NuORDER; with this export she types only the sizes, and the header, totals and notes are already filled in. Any automatic source would need either (a) a size-quantity field on the DSA form, which changes the DSA workflow and isn't recommended now, or (b) a sizing file Madison already keeps, which, if it exists, is already her NuORDER paste source.
- **NuORDER sequence:** Madison needs to send a NuORDER line-list export, or a style list in NuORDER order, just once for the season.

## What the real template contains (checked)

- **Header row:** Image, Style #, Color, Class, Style Description, US MSRP, Sizes, Total Units, then 24 door columns I–AF (8112-NP … 8073-NME).
- **Each style takes a 10-row block.** The top row holds style info, a typed **Total Units** and typed **requested units for each door**. Rows 2–9 are sizes 2–16. Row 10 is the sized subtotal for each door.
- **Requested totals and sized subtotals are separate numbers.** In 276 of the door cells, the top-row request doesn't match that door's sized total. Of the 708 subtotal cells, many are typed values rather than `SUM` formulas. So the size split is a separate buying decision made after the request. It doesn't follow from the request.
- **Class** uses values like SHIRT TOP, PANTS, DRESSES, KNIT, DENIM, JACKET, OUTERWEAR, SKIRT, GOWN. The Paris product records don't store class.
- **Special client notes** sit in column AG, a 25th column past the doors, as short tags such as "AT Client" on the relevant size row.

## Reassessment of the earlier proposal

| Earlier claim | Holds? |
|---|---|
| Fill door totals from DSA units | **Yes.** This matches the top-row "requested" cells exactly |
| Leave size rows blank | **Yes, and required.** The template proves the sizes are a separate decision |
| Size subtotals as SUM formulas | Keep. They're safer than typed values, and the top-row request stays visible next to them for comparison |
| Preferred-size hint as a cell comment | Change to **column AG text** (for example "pref 6/8"), which matches where Madison already looks |
| Client notes | Put a short "Client" flag plus the DSA client note in AG, on the style's top row |
| Class column | Leave **blank**. It isn't in the data and must not be guessed |
| Store-to-door match | Fill only stores confirmed to match a door code. Leave other doors empty and list them on the Validation sheet |

## Minimum update that saves re-keying

1. **Sizing export, filled automatically, no editor:** style #, color, description, MSRP, requested units for each door (top row), Total Units, size labels 2–16, SUM formulas and AG notes. Size cells stay empty. Remove the in-app size editor from the screen.
2. **Color by item:** pick one store and download a single sheet. Hide the sequence paste box.
3. **Label the order** "linesheet order — not verified against NuORDER".
4. No change to the DSA form, saved reviews, seasons or products.

**Saved:** building the header and style blocks, typing every door's requested units, and copying client notes. **Not saved:** typing size quantities. That needs a real source of size splits.

## Requires a true source (blocked, do not fake)

- **Quantities for each size:** these must come from Madison's own sizing decisions or a future DSA field. Even a single preferred size is not filled automatically unless Madison approves that rule.
- **NuORDER collection order:** needs an official order list or an export from NuORDER. Until then, the linesheet order is used and labeled as such.
- **Class for each style:** needs a source list from Akris or NuORDER.
- **Door code mapping:** needs the buying office to confirm it.

## Separate security flag: client notes are publicly readable

The `reviews` table is still readable by anyone with the app address. That includes `special_order_notes`, which holds client-backed notes and may name clients, plus DSA names. This was accepted as a pilot risk earlier. Putting these notes into exports makes it more sensitive. Fixing it properly needs real sign-in for buyers and DSAs, with reviews readable only by their owner and buyers. That's a separate task and isn't part of this export change.

## One question for Madison

"Should the sizing file leave every size cell blank for you to fill in, or may a single preferred size get all of that door's units?"

## Technical notes (build phase, only when directed)

- `workbooks.ts` `buildSizingWorkbook`: top-row door cells = `units(review)` (0 for red); size cells empty; row 10 = SUM; column AG text = preferred sizes and client flag; drop `allocations` from the inputs.
- `buildColorByItemWorkbook`: add a `store` filter.
- `NuorderExports.tsx`: add a store Select; remove the sequence Textarea and the allocation editor from the screen.
- Tests: one-store export contains only that store; no numbers appear in any size cell; door totals equal DSA units.
