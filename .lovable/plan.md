# Audit: what the NY sizing worksheet is for (no changes)

## Answer
The NY sizing worksheet is a **format template for the buyer's sizing export**. It is not a product or size-split source for the Paris Summer 2027 review now in the app. It does hold real NY numbers, but those numbers belong to a different set of styles and should not be imported.

## Facts: what the NY file contains
- Real NY Summer 2027 data: about 70 style/colors, each with class, door totals and a size split for 24 doors (columns I–AF).
- The size split is a separate buying decision. In 276 door cells, the sized total does not match the units requested in the top row. Many subtotals are typed numbers, not formulas.
- Notes for special client orders are in column AG.

## Evidence that it is only a template for the Paris review
1. **Different set of styles.** The Paris color worksheet has 41 rows, and they match the 41 Summer 2027 products in the app one for one. The NY styles are a different NY collection.
2. **What Madison asked for.** She wants a sized worksheet she can copy into NuORDER/GCC, so she does not have to re-key numbers. She is describing the layout of the file she wants back, not sending data to load.
3. **What each file does.** The Paris file is the DSA's input form (one units box and notes per style, no size columns). The NY file is the buyer's finished output. They come from opposite ends of the process.
4. **NY numbers would be wrong for Paris.** NY door totals and size splits come from NY's own decisions. Putting them on Paris styles would invent quantities, which breaks the rule that size splits are never made up.
5. **Past direction.** Earlier instructions said the NY file is a layout reference only and must never be used as the Paris product master. The export follows this: it copies the 32-column NY layout and loads no NY styles.

## What the NY file is still useful for (without importing it)
- Column layout, the size rows (2–16) and how the subtotal formulas are built.
- The class names (SHIRT TOP, PANTS, DRESSES and so on) and the door-code columns. Both are good hints but are not confirmed for Paris.
- An example of what a finished size split looks like.

## What is still unclear
- **Door codes:** NY door columns may or may not match the Paris door list. Two Paris stores (1020 Boston, 1001 Downtown) have no NY column.
- **Class for Paris:** No class list exists for the Paris styles. The NY class names show the format but say nothing about Paris products.
- **Overlapping styles:** If any style number appears in both collections, NY's class could be borrowed for it, but only with Madison's say-so. NY sizes should never be borrowed.
- **Where Paris sizes come from:** Still not decided. The options are Madison deciding the split, a future size field for DSAs, or an export from NuORDER/GCC.
- **NuORDER order:** Neither file proves the NuORDER style order.

## Question for Madison
Is the NY sizing worksheet just the format you want the Paris export to follow? And do the Paris doors use the same 24 door columns, or a different list?
