# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlineSheet (AL/NE) is a pilot-stage B2B buying review tool for a multi-store retail network. DSAs (store associates) review products with Green/Yellow/Red buy decisions; managers access analytics dashboards. The app is email-gated for audit purposes and has a password-protected manager portal.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint
npm test           # Run tests once (Vitest)
npm run test:watch # Watch mode tests
npm run preview    # Preview production build
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

### Stack
- **Frontend:** React 18, TypeScript, Vite (SWC), React Router v6
- **UI:** shadcn/ui (Radix UI primitives) + Tailwind CSS
- **State:** TanStack React Query v5 for server state; component `useState` for local UI state
- **Backend:** Supabase (PostgreSQL + Row-Level Security + Edge Functions)
- **Session:** localStorage (`alne-reviewer` key) — not Supabase Auth

### Route Structure (`src/App.tsx`)
All routes are wrapped by `EmailGate` (audit-only, not an auth barrier):
```
/           → Login (store + DSA selection)
/review     → Review (product carousel with decision buttons)
/final      → FinalReview (validation before submit)
/confirmation → Confirmation (export PDF/CSV/JSON)
/portal     → Portal (manager password entry)
/manager/*  → ManagerLayout (requires sessionStorage admin flag)
  /manager/home        → ManagerHome
  /manager             → ManagerDashboard (complex analytics)
  /manager/submissions → Manager (submissions table)
  /manager/governance  → Governance
  /manager/reports     → Reports
```

### Access Control Model
This is a **pilot system** with intentionally relaxed security:
1. **Email gate** (`src/components/EmailGate.tsx`): Captures email → logs to `access_log` table. Pure audit trail, not authentication.
2. **Reviewer session** (`src/lib/session.ts`): Self-asserted identity stored in localStorage. No auth system.
3. **Manager portal** (`src/lib/admin.ts`): Password validated by `verify-portal-password` Edge Function against env secrets `PORTAL_ADMIN_PASSWORD`/`PORTAL_BUYER_PASSWORD`. Unlock flag stored in sessionStorage.
4. **Supabase RLS**: Products are publicly readable. Reviews allow public INSERT/SELECT during pilot (intentional). Submitted reviews are immutable via a database trigger (`prevent_submitted_edits()`).

### Data Flow for Reviews (`src/lib/reviews.ts`)
Products and the current reviewer's drafts are fetched in parallel and merged client-side:
```
fetchProducts() + fetchReviewsFor(reviewer, store)
  → merged into ReviewItem[] (product + optional review)
  → displayed in Review.tsx carousel
  → changes → optimistic local update → debounced upsertReview() → Supabase
  → submitAll() → sets submission_status='submitted' (irreversible)
```

### Manager Dashboard (`src/pages/ManagerDashboard.tsx`)
This is the most complex file (42KB). Key quirk: it **augments real review data with deterministic mock data** — it hashes store codes into pseudo-random synthetic reviews to populate the dashboard during the pilot phase when real data is sparse. `src/components/dashboard/Infographics.tsx` contains the visualization components (HeroRatio, AssortmentMatrix, DoorHeatmap, CategoryRatios, ConvictionRibbon).

### Database Schema (Supabase)
- **products**: `id`, `style_number`, `long_style_desc`, `color`, `retail_price`, `image_url`, `season`, `sort_order`
- **reviews**: `id`, `product_id` (FK), `reviewer`, `store`, `decision_status` (green/yellow/red), `selected_sizes` (int[]), `requested_bulk_units`, `notes`, `special_order_notes`, `submission_status` (draft/submitted), `submitted_at`, `processed`, `processed_at`
- **access_log**: `id`, `email`, `path`, `user_agent`, `created_at`

Migrations are in `supabase/migrations/` — always add new schema changes as timestamped migration files.

### Tailwind Design Tokens
Custom decision colors are defined in `tailwind.config.ts`:
- `decision-green` / `decision-green-soft`
- `decision-yellow` / `decision-yellow-soft`
- `decision-red` / `decision-red-soft`

Use these for any UI that reflects buy decisions rather than ad-hoc color classes.

### TypeScript Config
Strict mode is disabled and `noUnusedLocals`/`noUnusedParameters`/`noImplicitAny` are all off. Path alias `@/*` maps to `src/*`.

### Supabase Edge Function
`supabase/functions/verify-portal-password/index.ts` is a Deno function. It fails closed if `PORTAL_ADMIN_PASSWORD`/`PORTAL_BUYER_PASSWORD` env secrets are not set — no hardcoded fallback passwords.

### Testing
Vitest with jsdom environment. Currently only a placeholder test exists (`src/test/example.test.ts`). Setup file is `src/test/setup.ts` (mocks `window.matchMedia`).

### Store Data
`src/lib/stores.ts` contains the 25 retail store codes, DSA staff names, and 5 pilot store entries hardcoded. This is an accepted PII exposure for the pilot phase.
