# Architecture

## System Overview

Memo is a Notion-style workspace app. The stack is a standard Next.js App Router
application backed by Supabase for persistence, auth, and realtime.

```
┌─────────────────────────────────────────────┐
│                  Vercel                      │
│  ┌───────────────────────────────────────┐   │
│  │         Next.js 16 (App Router)       │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────┐ │   │
│  │  │  Pages   │  │   API    │  │ Mid- │ │   │
│  │  │ (RSC +   │  │  Routes  │  │ ware │ │   │
│  │  │  Client) │  │          │  │      │ │   │
│  │  └────┬─────┘  └────┬─────┘  └──┬───┘ │   │
│  │       │              │           │     │   │
│  │       └──────┬───────┘           │     │   │
│  │              │                   │     │   │
│  │     ┌────────▼────────┐          │     │   │
│  │     │  Supabase SSR   │◄─────────┘     │   │
│  │     │  (client/server │                │   │
│  │     │   /proxy)        │                │   │
│  │     └────────┬────────┘                │   │
│  └──────────────┼────────────────────────┘   │
└─────────────────┼────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │     Supabase      │
        │  ┌─────────────┐  │
        │  │ PostgreSQL   │  │
        │  │ (RLS)        │  │
        │  ├─────────────┤  │
        │  │ Auth         │  │
        │  ├─────────────┤  │
        │  │ Realtime     │  │
        │  └─────────────┘  │
        └───────────────────┘
```

## Data Model

The core entities follow a workspace → pages → blocks hierarchy:

- **Workspace**: top-level container, owns pages and members
- **Page**: a document within a workspace, supports nesting (parent_id)
- **Block**: content unit within a page, stored as JSON (Tiptap/BlockNote format)

All tables use Supabase Row Level Security (RLS) to enforce access control.

## Key Decisions

| Decision | Rationale |
|---|---|
| Next.js App Router | Server components by default, streaming, built-in layouts |
| Supabase (not raw Postgres) | Auth, RLS, Realtime, and JS SDK out of the box |
| Tiptap or BlockNote for editor | Block-based editing with slash commands, JSON output |
| JSON block storage | Flexible schema for diverse block types |
| No ORM | Direct Supabase client calls — simpler, fewer abstractions |
| Tailwind + shadcn/ui | Consistent design system without custom CSS |

## Component Map

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (fonts, global styles)
│   ├── page.tsx            # Landing page
│   ├── global-error.tsx    # Sentry error boundary
│   ├── api/
│   │   └── health/         # Health check endpoint
│   └── (auth)/             # Auth routes (future)
├── components/
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   └── supabase/
│       ├── client.ts       # Browser client
│       ├── server.ts       # Server component client
│       └── proxy.ts        # Session refresh
├── proxy.ts                 # Root proxy (Supabase session, Next.js 16 convention)
└── instrumentation.ts      # Sentry server/edge init
```

## Observability

- **Sentry**: error tracking, performance monitoring, session replay
- **Health endpoint**: `/api/health` — checks DB connectivity
