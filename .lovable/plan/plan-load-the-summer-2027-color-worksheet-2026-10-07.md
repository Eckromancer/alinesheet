# Plan: Load the Summer 2027 color worksheet

## Goal
Add the attached Akris S27 Paris worksheet as the new active **Summer 2027** season while preserving the existing 103-product **Resort 2026** archive and its reviews.

## What I verified
- The PDF contains **41 product/color entries across 9 pages**, with style number, color, description, retail, and product imagery.
- The database currently contains **103 products**, all tagged `Resort 2026`.
- The DSA review, final review, buyer dashboard, and reports currently load products across every season, so they need season scoping before the new assortment is added.

## Implementation

1. **Import the new assortment**
   - Extract and quality-check the product imagery from the PDF.
   - Upload each available product image into a dedicated Summer 2027 image folder.
   - Insert all 41 entries in worksheet order with season `Summer 2027`, preserving separate rows when a style appears in multiple colors.
   - Verify style numbers, colors, descriptions, prices, image-to-style matching, row count, and ordering against the PDF.

2. **Make Summer 2027 the active DSA worksheet**
   - Scope product and review loading to the newest season rather than mixing archived and current products.
   - Update the DSA entry title to “Akris Summer 2027 Colors / Bulk.”
   - Keep the existing green/yellow/red, quantity, size, notes, autosave, final-review, submission, and worksheet-download flow unchanged.
   - Include the season in exported worksheet data and filenames where appropriate.

3. **Add season controls to the buying-office experience**
   - Add a season selector to the buyer dashboard, defaulting to the newest available season (`Summer 2027`).
   - Filter products, linked reviews, analytics, product imagery, door completion, rankings, and infographics to the selected season.
   - Preserve access to `Resort 2026` as a historical view without modifying its records.

4. **Scope reports by season**
   - Add the same season selector to Reports, defaulting to Summer 2027.
   - Filter both CSV exports to the selected season and add a season column and season-aware filename.

5. **Validate the update**
   - Confirm the DSA flow opens only the 41 Summer 2027 entries in worksheet order.
   - Confirm the buyer dashboard and reports switch cleanly between Summer 2027 and Resort 2026 without cross-season review leakage.
   - Check product imagery and key screens on desktop and tablet widths, then confirm the preview has no build or runtime errors.

## Technical details
- Existing products and reviews remain intact; the new season is appended, not substituted.
- Reviews remain linked to individual product records, allowing the same style/color to recur in another season without overwriting history.
- “Newest season” will use an explicit season-ordering rule rather than alphabetical sorting.
