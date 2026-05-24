## Plan: Close out remaining security findings (no code changes)

You chose to accept the current risk posture for the pilot. No application code or database changes are needed — this is purely security-tracking housekeeping so the dashboard reflects reality.

### What I'll do

1. **Staff names in JS bundle** — mark the finding as **Ignored** with the reason: "Pilot deployment with trusted audience; URL is not publicly advertised. Will revisit before broad rollout."

2. **Reviews table public access** — mark as **Ignored** with the reason: "UPDATE locked to draft rows; submitted reviews protected by trigger. SELECT/INSERT remain open intentionally during pilot because there is no auth system yet. Will be replaced with real authentication before broad rollout."

3. **Storage policies (product-images)** — already fixed in an earlier migration; mark as **Fixed** with that explanation so the outdated finding clears.

4. **Update the project security memory** so future scans don't re-flag the same accepted risks, and so the next agent knows:
   - This is a pilot with no real auth; reviewer identity is self-asserted via localStorage
   - Reviews SELECT/INSERT are intentionally open until auth is added
   - Staff names in `src/lib/stores.ts` are an accepted PII exposure during pilot
   - When auth is added, all three accepted risks must be revisited

### What I will NOT do

- No database migrations
- No code edits to `stores.ts`, edge functions, or login flow
- No changes to the reviews RLS policies beyond what's already in place

### After this runs

The security dashboard should show 0 open findings. The accepted risks are documented in security memory so they don't silently come back, and you have a clear checklist of what to revisit when you're ready to add real authentication.
