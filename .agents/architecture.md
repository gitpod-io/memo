# Architecture

## Overview

Memo is a Notion-style workspace app: block-based editor, nested pages, workspaces,
real-time collaboration. Built with Next.js 16 on Vercel, Supabase for data and auth,
Sentry for error tracking.

## System Diagram

```
Browser
  ├── Server Components → Supabase server client (read data, cookie-based auth)
  ├── Client Components → Supabase browser client (mutations, realtime subscriptions)
  ├── API Routes (/api/*) → server-side logic, health checks
  └── Proxy (src/proxy.ts) → Supabase session refresh, route protection

Supabase
  ├── PostgreSQL → workspaces, pages, blocks, members
  ├── Auth → GitHub/Google OAuth, email/password
  ├── Realtime → live collaboration (page edits, presence)
  └── RLS → row-level security per workspace

Sentry → error tracking, source maps, performance monitoring, session replay
Vercel → hosting, preview deploys per PR, production deploys on merge
```

## Data Model

```
workspace
  ├── has many: members (user_id + role)
  └── has many: pages
        ├── belongs to: workspace
        ├── has one: parent_page (nullable → enables nesting)
        └── has many: blocks (ordered by position)
              ├── type: text | heading_1 | heading_2 | heading_3 | bullet_list |
              │         numbered_list | todo | code | image | divider | callout | toggle
              └── content: JSON (structure varies by type)
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor library | Tiptap or BlockNote (evaluate before building) | Do NOT build a custom editor — this is months of work |
| Content storage | JSON block tree in PostgreSQL | Flexible, queryable, no HTML parsing needed |
| Auth | Supabase Auth with RLS | Row-level security at the DB layer, no app-level auth checks needed per query |
| Realtime | Supabase Realtime subscriptions | Built into the client, no extra infrastructure |
| Styling | Tailwind v4 + shadcn/ui | No custom CSS, consistent design system |
| Package manager | pnpm | Strict dependency resolution, faster installs |
| Session management | Next.js 16 proxy (not middleware) | `src/proxy.ts` with `updateSession` — Next.js 16 convention replacing middleware |

## Request Flow

1. User visits a page → proxy (`src/proxy.ts`) refreshes Supabase session via `updateSession`
2. Server component renders with data from Supabase server client (`@/lib/supabase/server`)
3. Client component hydrates, subscribes to Realtime for live updates
4. User edits a block → client component writes to Supabase → Realtime broadcasts to other users
5. Errors captured by Sentry (client via `instrumentation-client.ts`, server via `src/instrumentation.ts`)

## Component Map

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (Geist fonts, global styles)
│   ├── page.tsx            # Landing page
│   ├── global-error.tsx    # Sentry error boundary
│   └── api/
│       └── health/route.ts # Health check endpoint (DB connectivity)
├── lib/
│   └── supabase/
│       ├── client.ts       # Browser client (createBrowserClient)
│       ├── server.ts       # Server component client (createServerClient + cookies)
│       └── proxy.ts        # Session refresh logic (updateSession)
├── proxy.ts                # Root proxy — calls updateSession, skips static/health routes
└── instrumentation.ts      # Sentry server/edge init (register + onRequestError)
```

## Observability

- **Sentry client**: session replay (10% normal, 100% on error), route transition tracking
- **Sentry server**: PII enabled, local variables, 10% trace sampling in production
- **Health endpoint**: `GET /api/health` — checks DB connectivity, returns status + latency
