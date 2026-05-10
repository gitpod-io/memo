# Bundle Budget

Per-page budget: **200 kB** gzipped first-load JS.
Framework baseline budget: **160 kB** gzipped (shared by all routes).

Enforced by `pnpm test:bundle` (runs `scripts/check-bundle.mjs`).

## Current state (2026-05-10)

All 12 routes are within budget. The heaviest route is `/account` at ~185 kB.

| Route | First-load JS (gzip) | Headroom |
|---|---|---|
| /account | 185 kB | 15 kB |
| /sign-up | 180 kB | 20 kB |
| /sign-in | 179 kB | 21 kB |
| /reset-password | 179 kB | 21 kB |
| /forgot-password | 179 kB | 21 kB |
| /[workspaceSlug]/[pageId] | 177 kB | 23 kB |
| /[workspaceSlug]/settings/members | 174 kB | 26 kB |
| /[workspaceSlug]/settings | 173 kB | 27 kB |
| /[workspaceSlug] | 173 kB | 27 kB |
| /invite/[token] | 171 kB | 29 kB |
| / | 156 kB | 44 kB |
| /_not-found | 152 kB | 48 kB |

## Chunk architecture

Every page's first-load JS = framework baseline + route-group chunks + route-specific chunks.

### Framework baseline (~152 kB gzipped)

These chunks are shared by **all** routes. They cannot be split further — they are
the Next.js runtime, React, and shared utilities loaded by the root layout.

| Chunk | Size (gzip) | Contents |
|---|---|---|
| Next.js client runtime | ~71 kB | App Router, client-side navigation, prefetching |
| React runtime | ~33 kB | React core, reconciler, hooks |
| React primitives | ~12 kB | Slot, context, shared React internals |
| Next.js internals | ~10 kB | Process polyfill, error handling |
| Next.js navigation | ~7 kB | Link, router hooks, navigation utilities |
| Shared providers | ~6 kB | ThemeProvider, TooltipProvider (root layout) |
| Turbopack runtime | ~4 kB | Module loading, chunk resolution |
| UI primitives | ~3 kB | Shared Radix UI primitives |
| Bootstrap | ~2 kB | App initialization |
| Font loading | ~2 kB | Inter + JetBrains Mono font setup |

### Route-group shared chunks

| Chunk scope | Size (gzip) | Routes | Contents |
|---|---|---|---|
| Auth UI | ~9 kB | sign-in, sign-up, reset-password, forgot-password | Card, Button, Input, Label (shadcn/ui) |
| tailwind-merge | ~8 kB | All except / and /_not-found | `cn()` utility (clsx + tailwind-merge) |
| App shell | ~8 kB | All (app) routes | Sidebar context, AppShell wrapper |
| App navigation | ~4 kB | All (app) routes | Search, scroll utilities |

### Route-specific chunks

Each route has 0–13 kB of unique code (form logic, page-specific components).
These are already well-isolated by Next.js code splitting.

## Splitting strategy

The project uses three layers of defense against bundle bloat:

### 1. Lazy loading for heavy dependencies

Heavy libraries are loaded via `dynamic()` or `import()` so they stay out of
first-load JS:

- **Sentry SDK** (~130 kB): dynamically imported in `instrumentation-client.ts`
- **Supabase client** (~59 kB): lazy-loaded via `getClient()` in `src/lib/supabase/lazy-client.ts`
- **Lexical editor** (~200 kB): dynamically imported in `page-view-client.tsx` and `landing-demo-editor.tsx`
- **Database view** (~100 kB): dynamically imported in `page-content-client.tsx`
- **Sonner toaster**: dynamically imported in `providers.tsx`
- **OAuth buttons**: dynamically imported in auth form components
- **Error boundaries**: lazy-loaded via `lazy-route-error.tsx`
- **Sidebar components**: dynamically imported in `app-shell.tsx`
- **Keyboard shortcuts dialog**: dynamically imported in `sidebar-context.tsx`
- **Feedback form**: dynamically imported in `app-sidebar.tsx`

### 2. Server components by default

Most page-level data fetching and rendering happens in server components, which
contribute zero bytes to client JS. Only interactive components use `"use client"`.

### 3. CI enforcement

`pnpm test:bundle` runs on every PR and checks:
- **Per-route budget**: each page must be ≤ 200 kB gzipped first-load JS
- **Framework baseline**: shared chunks must total ≤ 160 kB gzipped

## When adding new features

Before merging, verify your changes don't regress bundle size:

1. Run `pnpm build && pnpm test:bundle`
2. Check the "Shared Chunk Analysis" output — if the framework baseline grew,
   you may have added an eager import to the root layout or providers
3. If a route exceeds 200 kB, apply one of these patterns:
   - `dynamic(() => import(...))` for components not needed at first paint
   - `import type` for TypeScript types (erased at compile time)
   - Move logic to a server component if it doesn't need browser APIs
   - Use `getClient()` from `lazy-client.ts` instead of importing Supabase directly

## Common pitfalls

- **Importing `@sentry/nextjs` directly** in client code — use `lazyCaptureException()` from `src/lib/capture.ts`
- **Importing `@supabase/supabase-js` directly** in client code — use `getClient()` from `src/lib/supabase/lazy-client.ts`
- **Eager imports in error boundaries** — use `LazyRouteError` from `src/components/lazy-route-error.tsx`
- **Adding providers to root layout** — every provider in `providers.tsx` adds to the framework baseline for all routes
- **`import { X } from "large-package"` in a `"use client"` file** — even if tree-shaken, the package's shared code may be pulled in
