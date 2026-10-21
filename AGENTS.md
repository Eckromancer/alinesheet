# Architecture Rules

- Centralize season ranking and filename normalization in `src/lib/seasons.ts` so every workflow selects the same newest assortment.- Keep buyer NuORDER export logic in `src/lib/nuorder/` (pure model + workbook builders) and its UI inside Reports only, so DSA entry and stored reviews are never touched by exports.
