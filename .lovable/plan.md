# AlineSheet: remove repetitive work for DSAs and buyers

Plan only. Nothing is changed until you approve it. No forecasting, AI or new dashboards.

## Current recurring workflow (from the code and Madison's emails)

```text
DSA:     open portal -> pick store/name -> tap G/Y/R, units, sizes, notes per style
         -> final review -> submit -> confirmation (CSV/PDF/email to buying office)
Buyer:   gets worksheets per door -> opens each door one at a time
         -> re-sorts by color to match the color doc / NuORDER order
         -> decides the split across sizes -> types every size for every door into NuORDER/GCC
```

## Where the manual work is

| Step | Who | Type | Avoidable now? |
|---|---|---|---|
| Opening each door's worksheet and re-sorting it by color | Madison | reformatting | **Yes** |
| Building the header, style rows and door totals in the sizing sheet | Madison | re-keying | **Yes** |
| Copying DSA notes and client notes into the buy | Madison | re-keying | **Yes** |
| DSA confirmation file or email sent to the buying office | DSA, then Madison | file handling, emails | Mostly. The data is already in the app |
| Chasing doors that haven't submitted | Madison | follow-up | Yes. A list of doors that have and haven't submitted |
| Typing quantities for each size into NuORDER | Madison | re-keying | **No.** No source holds these numbers today |
| Matching NuORDER's style order | Madison | reformatting | Only once the official order is available |
| Extra work our app added (size editor, order paste box, red "unmatched" warnings) | Madison | added by us | **Remove** |

## The 3–5 highest-value changes (smallest scope)

**Can be done now (no database change, DSA flow untouched):**
1. **One-door color-by-item download.** Pick a store and download it. Colors are section headers, styles sit underneath in linesheet order, and decision, units, preferred sizes, notes and client notes are filled in. It replaces opening and re-sorting each door's worksheet.
2. **Pre-filled sizing sheet in the NY layout.** Style, color, description, price, each door's requested units, Total Units, size rows 2–16 with total formulas, and notes in the last column. **Size cells are left blank.** Nothing is invented.
3. **Take out the work we added.** Remove the size editor, the order paste box and the "draft/blocking" alerts from Reports. Label the order "linesheet order — not verified against NuORDER".
4. **Door status line in Reports.** Show which doors have submitted for the season and which haven't. It uses data the app already has, and replaces checking her inbox and chasing doors.

**Depends on outside sources:**
5. **Quantities for each size** — need a source. There are two options:
   - (a) Capture them once at the start: replace the DSA's size buttons with a quantity for each size. This changes the DSA form and the data it saves, so it's only worth doing if buying confirms DSAs should decide the size split.
   - (b) Import a sizing file from an existing system (a NuORDER or GCC export) if one exists.
   Madison never re-enters sizes in this app. If neither source exists, sizes stay a buyer decision made in NuORDER.
- **NuORDER order:** needs a one-time line-list export from NuORDER. Until then, linesheet order is used.
- **Door codes (8112-NP and so on) matched to stores:** needs confirmation from the buying office.
- **Class:** needs a source list. Until then, it stays blank.

## Security blocker before live use

Confirmed: the `reviews` table can be read by anyone (open read policy), and anyone can add new reviews. Client notes, DSA names and stores can be read with only the public app key; the email gate doesn't protect them. Before real client notes are entered, add server-side access control: real sign-in for DSAs and buyers, reviews readable only by the DSA who wrote them and by buyers, and exports produced only for signed-in buyers. This is the one change where altering the database is unavoidable.

## Pilot sequence (one door: 1019 Michigan Avenue, Summer 2027)

1. **Before timing:** Madison times her current routine for that door, from receiving the worksheet to the buy being ready to enter in NuORDER (re-sorting, building the sheet, entering totals and notes). Count the actions she takes.
2. Build changes 1–4. Have the door's DSA submit as usual, with no change to their screens.
3. **After timing:** Madison downloads the two files for that door and does the same task.
4. Run one paste test of the sizing sheet into GCC/NuORDER, with sizes filled in by Madison.

**Pass if all of these hold:**
- The DSA flow has the same screens and the same number of taps.
- The color-by-item file matches her color doc layout for that door, and every submitted style appears exactly once.
- Each door's units in the sizing sheet equal the DSA's submitted units (0 for red), and no size cell contains a number she didn't enter.
- The paste into GCC/NuORDER works without reformatting.
- Her time and action count for that door are measurably lower. Report the real measured times, not estimates.

**Fail if any of these happen:** she has to re-sort, re-key totals, or enter sizes in this app, or the paste needs manual fixing.

## Blocking questions

1. Who decides the split across sizes: the DSA or the buyer? This decides option (a), option (b), or neither.
2. Does NuORDER or GCC have an export of the line list or the sizing data?
3. Can the buying office confirm which store goes with each door code?

## Technical notes

- `src/lib/nuorder/workbooks.ts`: add a store filter to color-by-item; for sizing, take door totals from `units(review)`, leave size cells empty, add SUM formulas, put notes in column AG, and drop `allocations`.
- `src/components/reports/NuorderExports.tsx`: add a store Select and a submitted/missing door list (from `reviews` + `STORES`); remove the Textarea and the allocation editor.
- Tests in `src/test/nuorder.test.ts`: a one-store export contains only that store; no size cell holds a number; door totals equal DSA units.
- The security step is a separate approved task: Supabase Auth, roles, RLS on `reviews`, and buyer-only export access.
