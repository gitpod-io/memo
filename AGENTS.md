# AGENTS.md

This repository is entirely agent-generated. No human writes code here.

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- Supabase: database (PostgreSQL), auth, realtime — via `@supabase/supabase-js`
- Sentry (`@sentry/nextjs`) for error tracking
- Storybook 8 (`@storybook/react-vite`) for component development and visual documentation
- Vitest for unit/integration tests, Playwright for E2E and visual regression
- Deployed on Vercel, domain: software-factory.dev

## Project Structure

```
src/app/           → Pages and API routes (App Router)
src/components/    → Reusable UI components (one per file, named exports)
src/components/ui/ → shadcn/ui components (do not edit)
src/lib/           → Utilities, types, constants
src/lib/supabase/  → Supabase clients (client.ts, server.ts, proxy.ts)
supabase/migrations/ → Database migrations
.storybook/        → Storybook config (main.ts, preview.ts, preview-head.html)
.agents/           → Agent knowledge base (architecture, conventions, design)
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
- **Issue-first workflow:** Before creating a `feat` or `fix` PR, create a GitHub issue first (or find an existing one). Label it `status:in-progress` immediately. Add `Closes #N` to the PR description. This prevents the PR Reviewer from blocking the merge.
- **Exception — `ona-user` PRs:** PRs created via interactive Ona sessions (user prompts) may use the `ona-user` label instead of linking an issue. The PR Reviewer will merge these without requiring `Closes #N`.
- UI component PRs must include co-located `*.stories.tsx` files covering default state, variants, and interactive states. The PR Reviewer will request stories if they are missing.
- Database changes require a migration: `npx supabase migration new <name>`
- Environment variables: `NEXT_PUBLIC_` prefix only for browser-safe values.

## Testing

### Testing pyramid

Each test type has a specific purpose. Do not substitute one for another.

- **Unit tests (Vitest):** utility functions, non-trivial logic, API route handlers, data transformations. Mock external dependencies (Supabase, fetch).
- **Component tests (Vitest + jsdom):** render components, verify callbacks fire, check state transitions. Use for logic-heavy components that don't need a real browser.
- **E2E tests (Playwright):** interactive features, critical user flows, new pages. **Mandatory** for any PR that adds or modifies interactive UI — see below.
- **Visual regression (Playwright):** `pnpm test:visual` — screenshots Storybook stories and compares against committed baselines in `e2e/visual-regression.spec.ts-snapshots/`
- **Static analysis tests (Vitest):** structural convention enforcement only (e.g., "no bare catch blocks", "no `@ts-ignore`", migration validation). **Never** for verifying feature behavior — see below.
- Skip tests for trivial layout-only components.

### E2E tests are mandatory for interactive UI

Any PR that adds or modifies components with user interactions (`onClick`, `onChange`, `onBlur`, `onKeyDown`, dropdowns, dialogs, popovers, drag-and-drop) **must** include E2E tests in the same PR. Do not defer E2E tests to follow-up issues.

E2E tests are required for:
- Buttons, dropdowns, and menus that trigger actions
- Inline editing (click-to-edit cells, inputs that appear on interaction)
- Dialogs and popovers (open, interact, dismiss)
- Drag-and-drop (editor blocks, sidebar pages, column reorder)
- Multi-step flows (auth, page creation, workspace switching)
- Any feature where the bug would only manifest in a real browser

When unit tests are sufficient (no E2E needed):
- Pure functions and utilities
- API route handlers (mock Supabase)
- Data transformations (markdown conversion, tree building)
- Components with no event handlers (pure render)

### PRs that change interaction flows must update E2E tests

Any PR that changes a user-facing interaction flow (button behavior, dialog flow, dropdown behavior, keyboard shortcuts) must update **all** affected E2E tests in the same PR. Search for all references: `grep -r '<component-name>\|<selector>' e2e/` before committing.

Do not merge interaction changes without verifying E2E tests pass. The PR Reviewer will block PRs that change interactive components without corresponding E2E test updates.

### No source-grep tests for feature behavior

Do not write Vitest tests that `readFileSync` source code and assert on string patterns (regex matching variable names, import paths, or code structure). These tests verify implementation details, not behavior. A refactor that preserves behavior but changes variable names breaks them; a bug with the right variable names passes them.

Source-grep tests are allowed **only** for structural convention enforcement:
- ✅ "All catch blocks capture the error variable" (convention check)
- ✅ "No `@ts-ignore` in source files" (convention check)
- ✅ "Migration files follow naming convention" (convention check)
- ❌ "handleAddColumn accepts a PropertyType parameter" (feature behavior — use E2E or component test)
- ❌ "addProperty is called with dynamic type, not hardcoded" (feature behavior — use E2E or component test)

### Storybook is the visual source of truth

Storybook stories are not just for regression detection — they are the reference for what components should look like. Verification must compare **rendered output**, not just source code tokens.

- **Feature Builder:** After creating/modifying UI components, build Storybook, open stories in a browser, and visually verify the rendered output matches `.agents/design.md` before committing.
- **PR Reviewer:** When reviewing UI PRs, build Storybook, open changed component stories, and verify the rendered output matches the design spec and PR intent.
- **UI Verifier:** After merge, screenshot Storybook stories and corresponding live site pages, and compare for integration-level discrepancies (components that work in isolation but break in the real page context).

### E2E test location

- Config: `playwright.config.ts`
- Tests: `e2e/` directory
- Auth fixture: `e2e/fixtures/auth.ts` — provides `authenticatedPage` for tests needing login
- Authenticated tests require `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env vars

### Running tests

- Run before pushing: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`

## Backlog

Issues use labels for status, priority, and flags:
- Status: `status:backlog`, `status:in-progress`, `status:in-review`, `status:done`
- Priority: `priority:1` (foundation), `priority:2` (features), `priority:3` (polish)
- Type: `bug`, `feature`, `enhancement`, `chore`, `performance`
- Flag: `needs-human` — excludes the issue from automation queues until a human responds. The Needs-Human Requeue automation removes this label when new comments are detected, and the Feature Planner re-triages on its next run.
- Flag: `ona-user` — applied to PRs created via interactive Ona sessions. The PR Reviewer merges these without requiring a linked issue.
- Query: `gh issue list --label "status:backlog" --label "priority:1" --state open`

Label lifecycle: `status:backlog` → `status:in-progress` → `status:in-review` → `status:done`

### Label rules to avoid automation conflicts

- `status:backlog` — **only** for issues you want automations (Feature Builder, Bug Fixer) to pick up. These automations poll for `status:backlog` issues on a cron schedule.
- `status:in-progress` — use when creating an issue for work you are already doing. This prevents automations from picking it up.
- Never create an issue with `status:backlog` if you intend to work on it yourself — use `status:in-progress` instead.
- Never create an issue with `status:in-progress` if you are only raising/suggesting it without implementing it — use `status:backlog` so automations can pick it up.

### How to request a feature or improvement

1. Create a GitHub Issue using the feature or bug template.
2. The Feature Planner triages unlabeled issues on its next manual run.
3. If detail is sufficient, labels are added and the issue enters the automation queue.
4. If detail is insufficient, `needs-human` is added with specific questions — respond to them and the automation will re-queue the issue.

### Automation development loop

These automations work together to implement features and fix bugs autonomously.
All automations run as the `sw-factory-automations` service account.

| Automation | Trigger | Role |
|---|---|---|
| Feature Planner | Cron (1h) | Triages unlabeled issues, decomposes specs into issues |
| Feature Builder | Cron (2h) | Implements features/enhancements from backlog |
| Bug Fixer | Cron (2h) | Implements bug fixes from backlog |
| PR Reviewer | Cron (30 min) + webhook | Reviews and merges PRs |
| Post-Merge Verifier | On PR merge | Smoke-tests production after merge |
| UI Verifier | On PR merge | Checks design spec compliance |
| PR Shepherd | Cron (2h) | Unsticks stalled PRs, resolves conflicts and duplicates |
| Stale Issue Reviewer | Cron (4h) | Resets stuck in-progress issues to backlog |
| Needs-Human Requeue | Cron (2h) | Re-queues issues after user responds |
| Incident Responder | Cron (1h) | Triages Sentry errors into bug issues |
| Performance Monitor | Weekly (Mon 10 AM UTC) | Checks latency, errors, build size |
| Feedback Digest | Cron (1h) | Posts categorized user feedback digest to Slack |
| Product Improver | Mon + Thu (9 AM UTC) | Proposes enhancement issues from live product review |
| Tweet Drafter | 3x daily (9, 15, 21 UTC) | Posts build-in-public updates to @swfactory_dev |
| Daily Metrics | Daily (9 AM UTC) | Collects daily project stats |
| Weekly Recap | Weekly (Mon 9 AM UTC) | Produces weekly summary for build-in-public audience |
| Automation Auditor | Weekly (Mon 8 AM UTC) | Reviews automation performance and knowledge base freshness |

For full details on the development workflow, see `.ona/skills/development-workflow/SKILL.md`.

## Where to Find Details

- Architecture and data flow: `.agents/architecture.md`
- Design spec (colors, typography, spacing, components, interactions): `.agents/design.md`
- Coding patterns and conventions: `.agents/conventions.md`
- Quality status per domain: `.agents/quality.md`
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
