# Architecture Rules

- Centralize season ranking and filename normalization in `src/lib/seasons.ts` so every workflow selects the same newest assortment.- Keep buyer NuORDER export logic in `src/lib/nuorder/` (pure model + workbook builders) and its UI inside Reports only, so DSA entry and stored reviews are never touched by exports.

- Review access is authorized server-side by `can_access_review(reviewer, store)`: buyers (user_roles) see all, DSAs only the reviewer/store in `dsa_identity`, assigned from the `access_grants` email allowlist on signup — so existing reviews keep ownership without rewriting rows. Anonymous access to reviews and products is removed and `AUTH_REQUIRED` is true; keep both in place so data stays behind sign-in.
- Fixed per-door allocations live in `door_quotas` (buyer-edit, DSA read-own-store) and per-size DSA counts in `reviews.size_quantities`; a DB trigger enforces sum ≤ quota on save and = quota on submit. Workflow switch and rules are in `src/lib/quota.ts` (`QUOTA_WORKFLOWS`) so other seasons/doors keep the request workflow.
