# Architecture Rules

- Centralize season ranking and filename normalization in `src/lib/seasons.ts` so every workflow selects the same newest assortment.- Keep buyer NuORDER export logic in `src/lib/nuorder/` (pure model + workbook builders) and its UI inside Reports only, so DSA entry and stored reviews are never touched by exports.

- Review access is authorized server-side by `can_access_review(reviewer, store)`: buyers (user_roles) see all, DSAs only the reviewer/store in `dsa_identity`, assigned from the `access_grants` email allowlist on signup — so existing reviews keep ownership without rewriting rows. Anonymous policies are removed only via `supabase/staged/lockdown.sql` together with `AUTH_REQUIRED` in `src/lib/auth.ts`, to avoid locking out active DSAs.
