# Architecture Rules

- Centralize season ranking and filename normalization in `src/lib/seasons.ts` so every workflow selects the same newest assortment.