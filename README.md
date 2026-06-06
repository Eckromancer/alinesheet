# AlineSheet

A B2B buying review tool for Akris PS27 Cruise — streamlines product evaluation decisions across a multi-store retail network.

## What it does

Store associates (DSA representatives) review Akris PS27 Cruise color and bulk products, making buy/skip decisions with size and quantity selections. Managers get a real-time dashboard showing participation rates, decision breakdowns, and size assortment heatmaps across ~25 retail doors.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui (Radix UI), Tailwind CSS
- **Backend:** Supabase (PostgreSQL + auth)
- **State:** TanStack React Query
- **Forms:** React Hook Form + Zod
- **Routing:** React Router v6
- **Reports:** jsPDF + autotable, Recharts

## Features

- **Review module** — DSA reps evaluate products and submit buy/skip decisions with size/quantity selection
- **Manager dashboard** — real-time analytics: store participation, green/yellow/red decision breakdown, size heatmaps
- **Confirmation portal** — multi-step review submission with final approval
- **Multi-store support** — 24 retail doors plus pilot programs with store-specific DSA management
- **Access control** — email gate restricts access to authorized users
- **Data export** — PDF report generation for manager governance

## Getting started

```bash
npm install
npm run dev
```

Requires a Supabase project — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env.local` file.
