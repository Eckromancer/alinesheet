# Architecture Rules

- Centralize season ranking and filename normalization in `src/lib/seasons.ts` so every workflow selects the same newest assortment.
- Keep NuORDER export layout (door columns, style sequence, block rows) in `src/lib/nuorder/`, validated by tests against the read-only source workbook fixture, so exports never drift from the buying office template.
- NuORDER size cells come only from buyer-confirmed allocations; never derive per-size quantities from selected sizes.
