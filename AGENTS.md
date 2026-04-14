# AGENTS.md

This repository is entirely agent-generated. No human writes code here.

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- Supabase: database (PostgreSQL), auth, realtime — via `@supabase/supabase-js`
- Sentry (`@sentry/nextjs`) for error tracking
- Vitest for unit/integration tests, Playwright for E2E
- Deployed on Vercel, domain: software-factory.dev

## Project Structure

```
src/app/           → Pages and API routes (App Router)
src/components/    → Reusable UI components (one per file, named exports)
src/components/ui/ → shadcn/ui components (do not edit)
src/lib/           → Utilities, types, constants
src/lib/supabase/  → Supabase clients (client.ts, server.ts, proxy.ts)
supabase/migrations/ → Database migrations
.agents/           → Agent knowledge base (architecture, conventions, design, plans)
.ona/              → Automation definitions and skills
docs/              → Product spec, decisions
metrics/           → Daily/weekly metrics snapshots
```

## Rules

- Server components by default. `"use client"` only for hooks, event handlers, or browser APIs.
- No `any`. No `@ts-ignore`. No `as` casts unless unavoidable (comment why).
- No ORMs — use `@supabase/supabase-js` for all database operations.
- No custom CSS — Tailwind utility classes only.
- Check shadcn/ui before building custom components.
- Named exports only. No default exports.
- Conventional commits: `feat|fix|chore|docs|test|refactor(scope): description`
- PRs with type `feat` or `fix` must reference an issue: `Closes #N`. Chore PRs (metrics, docs, deps) do not require an issue.
- Database changes require a migration: `npx supabase migration new <name>`
- Environment variables: `NEXT_PUBLIC_` prefix only for browser-safe values.

## Testing

- Unit tests: utility functions, non-trivial logic
- Integration tests: API routes
- E2E (Playwright): critical user flows, new pages
- Skip tests for trivial layout-only components
- Run before pushing: `pnpm lint && pnpm typecheck && pnpm test`

## Backlog

Issues use labels for status, priority, and flags:
- Status: `status:backlog`, `status:in-progress`, `status:in-review`, `status:done`
- Priority: `priority:1` (foundation), `priority:2` (features), `priority:3` (polish)
- Type: `bug`, `feature`, `enhancement`, `chore`, `performance`
- Flag: `needs-human` — permanently excludes the issue from all automation queues
- Query: `gh issue list --label "status:backlog" --label "priority:1" --state open`

Label lifecycle: `status:backlog` → `status:in-progress` → `status:in-review` → `status:done`

## Where to Find Details

- Architecture and data flow: `.agents/architecture.md`
- Design spec (colors, typography, spacing, components, interactions): `.agents/design.md`
- Coding patterns and conventions: `.agents/conventions.md`
- Quality status per domain: `.agents/quality.md`
- Active plans: `.agents/plans/active/`
- Completed plans: `.agents/plans/completed/`
- Product specification: `docs/product-spec.md`

## Next.js

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

## Do NOT

- Install deps without checking if an existing one covers the need
- Create files outside the established directory structure
- Commit `.env`, `node_modules/`, `.next/`
- Leave TODO comments — implement it or note in the PR description
- Modify files unrelated to the current task
- Silently exit on failure — always report visibly (issue comment, PR comment, or new bug issue)
