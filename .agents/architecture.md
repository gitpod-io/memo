# Architecture

## Overview

Memo is a Notion-style workspace app: Lexical block editor, nested pages, personal +
team workspaces, member invitations. Built with Next.js 16 on Vercel, Supabase for
data and auth, Sentry for error tracking. Realtime collaboration is deferred to post-MVP.

## System Diagram

```
Browser
  ├── Server Components → Supabase server client (read data, cookie-based auth)
  ├── Client Components → Supabase browser client (mutations, Lexical editor)
  ├── API Routes (/api/*) → server-side logic, health checks
  └── Proxy (src/proxy.ts) → Supabase session refresh, route protection

Supabase
  ├── PostgreSQL → profiles, workspaces, members, workspace_invites, pages
  ├── Auth → email/password (OAuth deferred — buttons rendered with "coming soon")
  ├── Storage → image uploads for editor
  ├── DB Triggers → handle_new_user (profile + personal workspace + owner membership)
  └── RLS → row-level security per workspace membership

Sentry → error tracking, source maps, performance monitoring, session replay
Vercel → hosting, preview deploys per PR, production deploys on merge
```

## Data Model

The foundational schema is implemented in `supabase/migrations/20260415092907_create_schema.sql`.
See `docs/product-spec.md` → Data Model for the full column-level schema.

```
profiles (1:1 with auth.users)
  └── created automatically on sign-up via handle_new_user trigger

workspaces
  ├── is_personal: boolean (personal workspace = non-deletable, always listed first)
  ├── created_by → profiles.id
  ├── Constraint: max 3 workspaces per user (created_by count, enforced via DB trigger)
  ├── Constraint: one personal workspace per user (partial unique index)
  ├── has many: members (user_id + role: owner | admin | member)
  ├── has many: workspace_invites (email + role + token)
  └── has many: pages
        ├── parent_id → pages.id (nullable, enables nesting)
        ├── content: jsonb (Lexical editor state — NOT a separate blocks table)
        ├── position: integer (ordering among siblings)
        └── created_by → profiles.id

Sign-up flow (atomic, via DB trigger):
  1. auth.users row created by Supabase Auth
  2. handle_new_user trigger fires → creates:
     a. profiles row
     b. workspaces row (is_personal = true, name = "{display_name}'s Workspace")
     c. members row (role = owner)
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor library | **Lexical** (Meta, MIT) | Full control, MIT license, Meta-backed. Build from lexical-playground reference, adapt to Tailwind + shadcn/ui. |
| Content storage | Lexical JSON in PostgreSQL `jsonb` | `editorState.toJSON()` stored in `pages.content`. No separate blocks table. |
| Auth | Supabase Auth — email/password | OAuth (GitHub, Google) deferred to post-MVP. Buttons rendered with "coming soon" tooltip. |
| Workspace model | Personal + team workspaces | Auto-created personal workspace on sign-up (non-deletable). Max 3 created workspaces per user. Unlimited joined via invite. |
| Realtime | Deferred to post-MVP | Yjs + Supabase Realtime adds complexity. Ship single-user editing first. |
| Styling | Tailwind v4 + shadcn/ui | No custom CSS, consistent design system |
| Package manager | pnpm | Strict dependency resolution, faster installs |
| Session management | Next.js 16 proxy (not middleware) | `src/proxy.ts` with `updateSession` — Next.js 16 convention replacing middleware |
| Floating UI | `@floating-ui/react` | Positioning for slash command menu, floating toolbar, link editor (same as Lexical playground) |
| Image storage | Supabase Storage | Bucket for uploaded images, public URL stored in ImageNode |
| Full-text search | PostgreSQL `tsvector` + `tsquery` | Generated column or trigger on page title + extracted content text |

## Lexical Editor — Implementation Plan

The Lexical playground (`facebook/lexical/packages/lexical-playground`) is the reference.
We do NOT fork it. We build a Memo-specific editor using official Lexical packages,
referencing the playground for patterns. All UI rebuilt with Tailwind + shadcn/ui.

### Official Lexical packages (install from npm)

| Package | Purpose |
|---|---|
| `lexical` | Core editor engine |
| `@lexical/react` | React bindings (LexicalComposer, plugins, hooks) |
| `@lexical/rich-text` | Headings, quotes, rich text support |
| `@lexical/list` | Bullet, numbered, and check lists |
| `@lexical/code` | Code blocks |
| `@lexical/link` | Link nodes and auto-linking |
| `@lexical/selection` | Selection utilities |
| `@lexical/utils` | Shared utilities |
| `@lexical/markdown` | Markdown import/export transforms |
| `@lexical/clipboard` | Copy/paste handling |

Pin to a specific version to avoid breaking changes.

### Custom plugins (referencing playground)

| Plugin | Playground reference | Complexity |
|---|---|---|
| ComponentPickerPlugin (slash commands) | `plugins/ComponentPickerPlugin` | Medium |
| DraggableBlockPlugin (drag-and-drop) | `plugins/DraggableBlockPlugin` | High |
| FloatingTextFormatToolbarPlugin | `plugins/FloatingTextFormatToolbarPlugin` | High |
| FloatingLinkEditorPlugin | `plugins/FloatingLinkEditorPlugin` | Medium |
| ImagesExtension | `plugins/ImagesExtension` | High |
| CodeHighlightExtension | `plugins/CodeHighlightExtension` | Medium |
| CollapsibleExtension (toggle blocks) | `plugins/CollapsibleExtension` | Medium |
| ToolbarPlugin (top toolbar) | `plugins/ToolbarPlugin` | High |

### Custom nodes

| Node | Type | Purpose |
|---|---|---|
| ImageNode | DecoratorNode | Image display with caption, resize handles |
| CalloutNode | ElementNode | Callout/alert block with emoji + text |
| DividerNode | HorizontalRuleNode (`@lexical/extension`) | Horizontal divider |

### Skipped plugins (not needed for MVP)

ExcalidrawPlugin, EquationsPlugin, PollPlugin, FigmaExtension, MentionsPlugin,
SpeechToTextPlugin, AutocompletePlugin, CommentPlugin, TablePlugin, LayoutPlugin,
DateTimeExtension, VersionsPlugin.

### Content storage flow

```
Save: editor.getEditorState().toJSON() → Supabase pages.content (jsonb)
Load: editor.setEditorState(editor.parseEditorState(json))
Auto-save: debounce 500ms on editor change → write to Supabase
```

## Request Flow

1. User visits a page → proxy (`src/proxy.ts`) refreshes Supabase session via `updateSession`
2. Server component renders with data from Supabase server client (`@/lib/supabase/server`)
3. Client component hydrates, initializes Lexical editor with saved content from `pages.content`
4. User edits content → Lexical editor state changes → debounced auto-save writes `editorState.toJSON()` to Supabase
5. Errors captured by Sentry (client via `instrumentation-client.ts`, server via `src/instrumentation.ts`)

## Component Map

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (JetBrains Mono font, TooltipProvider)
│   ├── page.tsx            # Landing page (redirects authenticated users to workspace)
│   ├── manifest.ts         # PWA manifest (name, icons, display mode)
│   ├── global-error.tsx    # Sentry error boundary
│   ├── globals.css         # Tailwind v4 theme — dark-only oklch tokens, --radius: 0
│   ├── (auth)/             # Unauthenticated route group
│   │   ├── layout.tsx      # Centered card layout for auth pages
│   │   ├── sign-in/page.tsx # /sign-in — email/password form
│   │   └── sign-up/page.tsx # /sign-up — display name + email/password form
│   ├── (app)/              # Authenticated route group
│   │   ├── layout.tsx      # Auth guard, fetches profile, renders AppShell
│   │   └── [workspaceSlug]/
│   │       ├── page.tsx    # /[workspaceSlug] — workspace home (page list or empty state)
│   │       └── [pageId]/page.tsx  # /[workspaceSlug]/[pageId] — page with title + editor placeholder
│   └── api/
│       └── health/route.ts # Health check endpoint (DB connectivity)
├── components/
│   ├── auth/
│   │   ├── oauth-buttons.tsx    # GitHub + Google buttons (disabled, "coming soon" tooltip)
│   │   └── sign-out-button.tsx  # Sign-out button (clears session, redirects to /sign-in)
│   ├── sidebar/             # App shell sidebar components
│   │   ├── app-shell.tsx        # Client wrapper: SidebarProvider + sidebar + main layout
│   │   ├── app-sidebar.tsx      # Sidebar (desktop: collapsible aside, mobile: Sheet)
│   │   ├── sidebar-context.tsx  # React context for sidebar open/close state + ⌘+\ shortcut
│   │   ├── workspace-switcher.tsx # Dropdown listing all workspaces, create workspace trigger
│   │   ├── create-workspace-dialog.tsx # Dialog for creating a new workspace
│   │   ├── page-tree.tsx        # Hierarchical page tree with CRUD, drag-and-drop, nest/unnest
│   │   └── user-menu.tsx        # User dropdown with settings link + sign-out
│   ├── page-title.tsx           # Inline-editable page title (saves on blur/Enter)
│   ├── workspace-home.tsx       # Workspace home: page list or empty state with create CTA
│   ├── workspace-settings-form.tsx # Edit workspace name/slug, delete workspace
│   └── ui/                 # shadcn/ui components (base-nova style, base-ui primitives)
│       ├── alert-dialog.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       └── tooltip.tsx
├── lib/
│   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── types.ts            # Database entity types
│   ├── workspace.ts        # Workspace utilities: slug generation, validation, limits
│   └── supabase/
│       ├── client.ts       # Browser client (createBrowserClient)
│       ├── server.ts       # Server component client (createServerClient + cookies)
│       └── proxy.ts        # Session refresh + auth redirect logic (updateSession)
├── proxy.ts                # Root proxy — calls updateSession, skips static/health routes
└── instrumentation.ts      # Sentry server/edge init (register + onRequestError)

Root config files:
├── instrumentation-client.ts  # Sentry client init (replay, route transitions)
├── sentry.server.config.ts    # Sentry server SDK config
├── sentry.edge.config.ts      # Sentry edge SDK config
├── sentry.client.config.ts    # Sentry client SDK config
└── components.json            # shadcn/ui config (base-nova style, Tailwind v4)
```

Planned structure (added as features are built):

```
src/
├── app/
│   ├── (auth)/                        # Unauthenticated routes
│   │   ├── sign-in/page.tsx           # /sign-in
│   │   ├── sign-up/page.tsx           # /sign-up
│   │   └── invite/[token]/page.tsx    # /invite/[token]
│   ├── (app)/                         # Authenticated routes
│   │   ├── layout.tsx                 # App shell (sidebar + main content), passes userId
│   │   └── [workspaceSlug]/
│   │       ├── page.tsx               # /[workspaceSlug] (workspace home)
│   │       ├── [pageId]/page.tsx      # /[workspaceSlug]/[pageId] (page view + editor placeholder)
│   │       └── settings/
│   │           ├── page.tsx           # /[workspaceSlug]/settings (name, slug, delete)
│   │           └── members/page.tsx   # /[workspaceSlug]/settings/members — planned
│   └── api/
│       ├── health/                    # Existing
│       └── ...                        # Additional API routes as needed
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── editor/             # Lexical editor + plugins
│   ├── sidebar/            # Sidebar, page tree, workspace switcher
│   └── ...                 # Feature-specific components
├── lib/
│   ├── supabase/           # Existing
│   └── types.ts            # Shared TypeScript types
└── ...
```

## Observability

- **Sentry client**: session replay (10% normal, 100% on error), route transition tracking
- **Sentry server**: PII enabled, local variables, 10% trace sampling in production
- **Health endpoint**: `GET /api/health` — checks DB connectivity, returns status + latency
