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
  ├── Auth → email/password + OAuth (GitHub, Google)
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
        ├── icon: text (emoji character for page icon, nullable)
        ├── cover_url: text (public URL of cover image in Supabase Storage, nullable)
        ├── is_database: boolean (default false — when true, page is a database container)
        ├── position: integer (ordering among siblings)
        ├── created_by → profiles.id
        ├── deleted_at: timestamptz (nullable — NULL = active, non-null = trashed)
        └── search_vector: tsvector (generated, title weight A + content text weight B, GIN indexed)
        When is_database = true:
        ├── child pages (parent_id = this page) are database rows
        ├── has many: database_properties (schema columns)
        ├── has many: database_views (saved views: table, board, list, calendar, gallery)
        └── row pages have many: row_values (property values per row per property)

database_properties (schema definition — columns of a database)
  ├── database_id → pages.id (ON DELETE CASCADE, where is_database = true)
  ├── name: text (unique per database)
  ├── type: text (text | number | select | multi_select | status | checkbox | date | url | email | phone | person | files | relation | formula | created_time | updated_time | created_by)
  ├── config: jsonb (type-specific: select options, number format, formula expression, relation target)
  ├── position: integer (column ordering)
  └── Index: (database_id, position)
  RLS: workspace members can CRUD properties for databases in their workspace.

database_views (saved views on a database)
  ├── database_id → pages.id (ON DELETE CASCADE)
  ├── name: text (default 'Default view')
  ├── type: text (table | board | list | calendar | gallery)
  ├── config: jsonb (visible_properties, sorts, filters, plus type-specific config)
  ├── position: integer (view tab ordering)
  └── Index: (database_id, position)
  RLS: workspace members can CRUD views for databases in their workspace.

row_values (property values for each database row)
  ├── row_id → pages.id (ON DELETE CASCADE — the row page)
  ├── property_id → database_properties.id (ON DELETE CASCADE)
  ├── value: jsonb (format depends on property type)
  ├── UNIQUE(row_id, property_id)
  └── Index: GIN on (property_id, value) for filtering
  RLS: workspace members can CRUD values for rows in their workspace.

page_visits (tracks recently visited pages per user per workspace)
  ├── workspace_id → workspaces.id
  ├── user_id → auth.users.id
  ├── page_id → pages.id
  ├── visited_at: timestamptz (updated on each visit via upsert)
  ├── Constraint: unique(workspace_id, user_id, page_id)
  └── RLS: users can only read/write their own visits

favorites
  ├── workspace_id → workspaces.id
  ├── user_id → profiles.id
  ├── page_id → pages.id
  ├── created_at: timestamptz
  └── UNIQUE(workspace_id, user_id, page_id)
  RLS: users can only read/write their own favorites within workspaces they're members of.

page_links (tracks which pages link to which other pages via inline PageLinkNode)
  ├── workspace_id → workspaces.id
  ├── source_page_id → pages.id (the page containing the link)
  ├── target_page_id → pages.id (the page being linked to)
  ├── created_at: timestamptz
  └── UNIQUE(source_page_id, target_page_id)
  Populated by application logic on auto-save (diffing PageLinkNode entries).
  RLS: workspace members can read/insert/delete links in their workspace.

page_versions (snapshots of page content for version history and restore)
  ├── page_id → pages.id (ON DELETE CASCADE)
  ├── content: jsonb (Lexical editor state snapshot)
  ├── created_at: timestamptz
  ├── created_by → profiles.id
  └── Index: (page_id, created_at DESC) for efficient listing
  RLS: workspace members can read/insert versions for pages in their workspace.
  Versions are immutable — no update/delete policies. Pruning via security definer functions:
  `purge_old_page_versions()` removes versions older than 30 days,
  `prune_excess_page_versions(page_id)` keeps only the latest 50 per page.
  Created every 5 minutes during auto-save (deduplicated — skipped if content unchanged).

user_feedback (user-submitted feedback: bugs, features, general)
  ├── user_id → auth.users.id (ON DELETE CASCADE)
  ├── type: text (check: bug | feature | general)
  ├── message: text (not null)
  ├── page_path: text (nullable — URL path where feedback was submitted)
  ├── page_title: text (nullable)
  ├── screenshot_url: text (nullable — public URL in feedback-screenshots bucket)
  ├── metadata: jsonb (nullable)
  ├── status: text (check: new | reviewed | actioned | dismissed, default 'new')
  └── created_at: timestamptz
  RLS: authenticated users can INSERT where user_id = auth.uid(). No SELECT/UPDATE/DELETE for regular users.

usage_events (server-side product analytics)
  ├── event_name: text (not null)
  ├── user_id → auth.users.id (ON DELETE CASCADE)
  ├── workspace_id: uuid (nullable)
  ├── page_path: text (nullable)
  ├── metadata: jsonb (nullable)
  ├── created_at: timestamptz
  └── Index: (event_name, created_at) for efficient digest queries
  RLS: authenticated users can INSERT where user_id = auth.uid(). No SELECT/UPDATE/DELETE for regular users.

Storage bucket: feedback-screenshots (public, 5 MB limit, png/jpeg/webp)
Storage bucket: avatars (public, 2 MB limit, png/jpeg/webp — users upload to {user_id}/ folder)

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
| Auth | Supabase Auth — email/password + OAuth | GitHub and Google OAuth via `signInWithOAuth`. Callback at `/auth/callback` handles email confirmation, OAuth code exchange, and password recovery. Password reset via `resetPasswordForEmail` + `updateUser`. |
| Workspace model | Personal + team workspaces | Auto-created personal workspace on sign-up (non-deletable). Max 3 created workspaces per user. Unlimited joined via invite. |
| Realtime | Deferred to post-MVP | Yjs + Supabase Realtime adds complexity. Ship single-user editing first. |
| Styling | Tailwind v4 + shadcn/ui | No custom CSS, consistent design system |
| Package manager | pnpm | Strict dependency resolution, faster installs |
| Session management | Next.js 16 proxy (not middleware) | `src/proxy.ts` with `updateSession` — Next.js 16 convention replacing middleware |
| Floating UI | `@floating-ui/react` | Positioning for slash command menu, floating toolbar, link editor (same as Lexical playground) |
| Row virtualization | `@tanstack/react-virtual` | Virtualizes table rows when count exceeds 50. Only visible rows + overscan buffer are rendered. |
| Image storage | Supabase Storage | Bucket for uploaded images, public URL stored in ImageNode |
| Full-text search | PostgreSQL `tsvector` + `tsquery` | Generated column on pages combining title (weight A) + extracted content text (weight B), GIN index, `search_pages` RPC |
| Page ancestors | PostgreSQL recursive CTE | `get_page_ancestors` RPC walks `parent_id` chain to build breadcrumb path. Returns ancestors root-first. `security invoker` respects RLS. |
| Soft delete | `deleted_at` column + RPCs | Pages are soft-deleted (moved to trash) instead of hard-deleted. `soft_delete_page` and `restore_page` RPCs use recursive CTEs to handle sub-pages. RLS policies split into active/trashed. `purge_old_trash` function for 30-day auto-purge, scheduled via Vercel Cron (`GET /api/cron/purge-trash` at 3 AM UTC daily) with pg_cron as a secondary mechanism when available. |
| Database views | Pages with `is_database = true` | Databases are special pages. Rows are child pages. Schema in `database_properties`, values in `row_values`, views in `database_views`. Reuses all page infrastructure (RLS, search, trash, versioning, backlinks). Client-side filtering/sorting initially. |
| Property type registry | `Record<PropertyType, {Renderer, Editor}>` | Extensible pattern — new property types added without modifying view components. Each type provides a cell renderer and inline editor. |
| Inline databases | Lexical `DatabaseNode` (DecoratorNode) | Embeds a database view inside any page. Stores `databaseId` + `viewId`. Compact rendering with expand-to-full-page button. |

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
| `@lexical/table` | Table nodes and utilities |
| `@lexical/clipboard` | Copy/paste handling |

Pin to a specific version to avoid breaking changes.

### Custom plugins (referencing playground)

| Plugin | Playground reference | Status |
|---|---|---|
| SlashCommandPlugin (slash commands) | `plugins/ComponentPickerPlugin` | Implemented |
| DraggableBlockPlugin (drag-and-drop) | `plugins/DraggableBlockPlugin` | Implemented |
| FloatingToolbarPlugin | `plugins/FloatingTextFormatToolbarPlugin` | Implemented |
| FloatingLinkEditorPlugin | `plugins/FloatingLinkEditorPlugin` | Implemented |
| ImagePlugin | `plugins/ImagesExtension` | Implemented |
| FloatingImageToolbarPlugin | N/A (custom) | Implemented |
| CodeHighlightPlugin | `plugins/CodeHighlightExtension` | Implemented |
| CalloutPlugin | N/A (custom) | Implemented |
| CollapsiblePlugin (toggle blocks) | `plugins/CollapsibleExtension` | Implemented |
| ListTabIndentationPlugin | N/A (custom) | Implemented |
| PageLinkPlugin (`[[` trigger + search) | N/A (custom) | Implemented |
| TablePlugin + TableActionMenuPlugin | `plugins/TablePlugin` | Implemented |
| DatabasePlugin (inline database block) | N/A (custom) | Implemented |
| TurnIntoPlugin + TurnIntoMenu (block transformation) | N/A (custom) | Implemented |
| AutoLinkPlugin (URL/email auto-detection) | `@lexical/react/LexicalAutoLinkPlugin` | Implemented |
| WordCountPlugin (word count + reading time) | N/A (custom) | Implemented |
| CodeLanguageSelectorPlugin (code block language picker) | `plugins/CodeActionMenuPlugin` | Implemented |
| ToolbarPlugin (top toolbar) | `plugins/ToolbarPlugin` | Deferred |

### Custom nodes

| Node | Type | Purpose | Status |
|---|---|---|---|
| ImageNode | DecoratorNode | Image display with caption | Implemented |
| CalloutNode | ElementNode | Callout/alert block with emoji + colored bg | Implemented |
| CollapsibleContainerNode | ElementNode | `<details>` wrapper for toggle blocks | Implemented |
| CollapsibleTitleNode | ElementNode | `<summary>` title for toggle blocks | Implemented |
| CollapsibleContentNode | ElementNode | Content area for toggle blocks | Implemented |
| PageLinkNode | DecoratorNode | Inline page link pill (stores pageId, renders title + icon) | Implemented |
| DatabaseNode | DecoratorNode | Inline database embed (stores databaseId + viewId, renders compact view) | Implemented |
| DividerNode | HorizontalRuleNode (`@lexical/react`) | Horizontal divider | Built-in |

### Skipped plugins (not needed for MVP)

ExcalidrawPlugin, EquationsPlugin, PollPlugin, FigmaExtension, MentionsPlugin,
SpeechToTextPlugin, AutocompletePlugin, CommentPlugin, LayoutPlugin,
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

## Database Views — Architecture

Databases are pages with `is_database = true`. This reuses all existing page infrastructure
(RLS, nesting, breadcrumbs, favorites, trash, search, version history, backlinks).

### How it works

```
Database page (is_database = true)
  ├── content: jsonb (optional Lexical content rendered above the database grid)
  ├── database_properties[] (schema — the columns)
  ├── database_views[] (saved views — table, board, list, calendar, gallery)
  └── child pages (parent_id = database page) = rows
       └── row_values[] (property values per row per property)
```

### Rendering flow

1. `[pageId]/page.tsx` fetches the page and checks `is_database`
2. If true, renders `DatabaseViewClient` instead of the standard `PageViewClient`
3. `DatabaseViewClient` loads properties, views, and rows via Supabase
4. Active view type determines which view component renders (TableView, BoardView, etc.)
5. Filters and sorts are applied client-side on the loaded row data
6. Cell edits write to `row_values` via Supabase (debounced auto-save)

### Component structure

```
src/components/database/
  ├── database-view-client.tsx     # Main client component: loads data, composes hooks + JSX
  ├── database-view-helpers.tsx    # ViewConfigDropdown, ComingSoonPlaceholder, DatabaseSkeleton
  ├── csv-export-button.tsx        # Download CSV toolbar button with relation title resolution
  ├── database-search-input.tsx    # Search input for filtering rows by title substring
  ├── hooks/
  │   ├── use-database-views.ts    # View CRUD: add, rename, delete, duplicate, reorder, config
  │   ├── use-database-rows.ts     # Row mutations: add, delete (deferred with undo), bulk delete, cell update, card move
  │   ├── use-database-properties.ts # Property CRUD: add, rename, delete (deferred with undo), reorder
  │   ├── use-database-filters.ts  # Sort/filter state and derived displayedRows
  │   └── use-row-selection.ts     # Row selection state: toggle, toggleAll, shift-range, clear, Escape
  ├── view-tabs.tsx                # Horizontal tab bar for switching views
  ├── filter-bar.tsx               # Active filter pills + add filter UI (composition only)
  ├── filter-value-editor.tsx      # Type-specific filter value editors, property picker, operator picker
  ├── sort-menu.tsx                # Sort configuration dropdown
  ├── property-types/              # Registry of type-specific renderers and editors
  │   ├── index.ts                 # PropertyTypeRegistry: Record<PropertyType, {Renderer, Editor}>
  │   ├── text.tsx
  │   ├── number.tsx
  │   ├── select.tsx
  │   ├── select-dropdown.tsx      # Shared dropdown for select/multi-select/status option picking
  │   ├── select-option-badge.tsx  # Colored badge for select option display
  │   ├── multi-select.tsx
  │   ├── status.tsx               # Status property (select variant with defaults: Not Started / In Progress / Done)
  │   ├── checkbox.tsx
  │   ├── date.tsx
  │   ├── url.tsx
  │   ├── email.tsx
  │   ├── phone.tsx
  │   ├── person.tsx
  │   ├── files.tsx
  │   ├── relation.tsx
  │   ├── formula.tsx
  │   └── computed.tsx             # created_time, updated_time, created_by (read-only)
  ├── views/
  │   ├── table-view.tsx           # Composition root — wires sub-components together, virtualizes rows >50
  │   ├── table-row.tsx            # TableRow — title cell + property cells for one row (own grid when virtualized)
  │   ├── table-cell.tsx           # TableCell + RegistryEditorCell — display/edit modes, portal editors
  │   ├── table-column-header.tsx  # TableColumnHeader — sort, menu, drag, resize handle
  │   ├── table-skeleton.tsx       # TableSkeleton — loading placeholder
  │   ├── table-navigation.ts     # useTableCellNavigation — editing/focus state, keyboard nav
  │   ├── table-columns.ts        # useColumnResize + useColumnDragReorder hooks
  │   ├── table-cell-renderer.tsx  # CellRenderer + SelectBadge — display-only value rendering
  │   ├── table-keyboard.ts       # handleCellKeyDown — editing-mode key handler
  │   ├── table-defaults.ts       # Pure helpers: value keys, select options, display values, date formatting
  │   ├── bulk-action-bar.tsx      # BulkActionBar — floating toolbar for bulk delete when rows are selected
  │   ├── row-count-status-bar.tsx # RowCountStatusBar — "X rows" / "X of Y rows" below the table
  │   ├── row-count-announcer.tsx  # RowCountAnnouncer — sr-only aria-live region for row count changes
  │   ├── database-empty-state.tsx # DatabaseEmptyState — shared empty state (no-rows vs filtered-empty)
  │   ├── board-view.tsx           # Kanban columns grouped by select property
  │   ├── board-view-helpers.ts    # Pure grouping/DnD logic extracted from board-view
  │   ├── board-keyboard.ts        # useBoardKeyboardNavigation — arrow key nav for board cards
  │   ├── list-view.tsx            # Compact vertical list
  │   ├── list-keyboard.ts         # useListKeyboardNavigation — arrow/Home/End key nav for list rows
  │   ├── calendar-keyboard.ts     # Keyboard navigation hook for calendar grid
  │   ├── calendar-view.tsx        # Month grid with date-positioned items
  │   ├── calendar-view-helpers.ts # Pure date/grid logic extracted from calendar-view
  │   ├── gallery-view.tsx         # Responsive card grid with cover + title
  │   └── gallery-keyboard.ts     # useGalleryKeyboardNavigation — arrow key nav for gallery cards
  └── row-properties-header.tsx    # Properties displayed above editor when row opened as page
```

### Row-as-page rendering flow

When a database row is opened as a full page (clicking a row title in table view):

1. `[pageId]/page.tsx` fetches the page and its ancestors via `get_page_ancestors` RPC
2. The RPC returns `is_database` for each ancestor — the immediate parent (last ancestor) is checked
3. If `parent.is_database === true` and the page itself is not a database, it's a row page
4. Server component loads the parent database's `database_properties` and the row's `row_values` in parallel
5. `RowPropertiesHeader` (client component) renders between breadcrumb and `PageViewClient`
6. Property values are inline-editable using the same `getPropertyTypeConfig()` registry
7. Computed properties (`created_time`, `updated_time`, `created_by`) derive values from page metadata
8. Breadcrumb shows `Table2` icon for database ancestors via `isDatabase` flag on `BreadcrumbItem`

### Key design decisions

- **Client-side filtering/sorting**: all rows loaded, filtered/sorted in browser. Server-side deferred.
- **Property type registry**: `Record<PropertyType, { Renderer, Editor }>` pattern for extensibility.
- **Formula evaluation**: simple recursive descent parser, evaluated at render time on the client.
- **Select option colors**: fixed palette of 8-10 muted colors from the design token set.
- **No new routes**: existing `[pageId]/page.tsx` handles both pages and databases.
- **Inline databases**: `DatabaseNode` (Lexical DecoratorNode) stores `databaseId` + `viewId`, renders compact view.

## Component Map

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (JetBrains Mono font, TooltipProvider)
│   ├── page.tsx            # Landing page (redirects authenticated users to workspace)
│   ├── manifest.ts         # PWA manifest (name, icons, display mode)
│   ├── robots.ts           # robots.txt — allows all crawlers, points to sitemap
│   ├── sitemap.ts          # sitemap.xml — public routes (/, /sign-in, /sign-up)
│   ├── opengraph-image.tsx # OG image (1200×630, generated via next/og ImageResponse)
│   ├── twitter-image.tsx   # Twitter card image (same design as OG image)
│   ├── global-error.tsx    # Sentry error boundary
│   ├── not-found.tsx       # Root 404 page
│   ├── globals.css         # Tailwind v4 theme — dark-only oklch tokens, --radius: 0
│   ├── auth/
│   │   └── callback/route.ts # Auth callback: email confirmation, OAuth, and password recovery redirect
│   ├── (auth)/             # Unauthenticated route group
│   │   ├── layout.tsx      # Centered card layout for auth pages
│   │   ├── sign-in/
│   │   │   ├── page.tsx        # /sign-in — server page
│   │   │   ├── error.tsx       # Sign-in error boundary (delegates to RouteError)
│   │   │   └── sign-in-form.tsx # Client form: email/password, redirect, ?confirmed banner, forgot password link
│   │   ├── sign-up/
│   │   │   ├── page.tsx        # /sign-up — server page
│   │   │   ├── error.tsx       # Sign-up error boundary (delegates to RouteError)
│   │   │   └── sign-up-form.tsx # Client form: display name + email/password, email confirmation screen
│   │   ├── forgot-password/
│   │   │   ├── page.tsx               # /forgot-password — server page
│   │   │   ├── error.tsx              # Forgot-password error boundary (delegates to RouteError)
│   │   │   └── forgot-password-form.tsx # Client form: email input, calls resetPasswordForEmail
│   │   ├── reset-password/
│   │   │   ├── page.tsx               # /reset-password — server page (landing from email link)
│   │   │   ├── error.tsx              # Reset-password error boundary (delegates to RouteError)
│   │   │   └── reset-password-form.tsx # Client form: new password + confirm, calls updateUser
│   │   └── invite/[token]/
│   │       ├── page.tsx    # /invite/[token] — invite accept flow
│   │       ├── error.tsx   # Invite error boundary (invite-specific messaging + sign-in link)
│   │       └── loading.tsx # Invite loading skeleton (Card with pulse placeholders)
│   ├── (app)/              # Authenticated route group
│   │   ├── layout.tsx      # Auth guard, fetches profile, renders AppShell
│   │   ├── loading.tsx     # App shell loading skeleton
│   │   ├── not-found.tsx   # App-level 404 page
│   │   ├── account/
│   │   │   ├── page.tsx     # /account — account settings (display name, avatar, password, delete)
│   │   │   ├── loading.tsx  # Account settings loading skeleton
│   │   │   └── error.tsx    # Account error boundary (delegates to RouteError)
│   │   └── [workspaceSlug]/
│   │       ├── page.tsx         # /[workspaceSlug] — workspace home (+ generateMetadata)
│   │       ├── loading.tsx      # Workspace loading skeleton
│   │       ├── error.tsx        # Workspace error boundary (delegates to RouteError)
│   │       ├── [pageId]/
│   │       │   ├── page.tsx     # /[workspaceSlug]/[pageId] — page view (+ generateMetadata)
│   │       │   ├── loading.tsx  # Page loading skeleton
│   │       │   └── error.tsx    # Page error boundary (delegates to RouteError)
│   │       └── settings/
│   │           ├── page.tsx         # /[workspaceSlug]/settings (+ generateMetadata)
│   │           └── members/page.tsx # /[workspaceSlug]/settings/members (+ generateMetadata)
│   └── api/
│       ├── account/route.ts # Account deletion (DELETE) → calls delete_account RPC (rate limited: 3/hour per user)
│       ├── feedback/route.ts # POST: submit user feedback (rate limited: 5/min per IP)
│       ├── health/route.ts  # Health check endpoint (DB connectivity)
│       ├── pages/[pageId]/versions/route.ts       # GET: list versions, POST: create version snapshot
│       ├── pages/[pageId]/versions/[versionId]/route.ts # GET: single version content, POST: restore version
│       ├── search/route.ts  # Full-text search (GET ?q=&workspace_id=) → search_pages RPC (rate limited: 30/min per IP)
│       └── cron/purge-trash/route.ts # Vercel Cron: purges pages trashed >30 days (CRON_SECRET auth)
├── components/
│   ├── auth/
│   │   ├── oauth-buttons.tsx    # GitHub + Google OAuth sign-in buttons (signInWithOAuth)
│   │   └── sign-out-button.tsx  # Sign-out button (clears session, redirects to /sign-in)
│   ├── sidebar/             # App shell sidebar components
│   │   ├── app-shell.tsx        # Client wrapper: SidebarProvider + sidebar + main layout
│   │   ├── app-sidebar.tsx      # Sidebar (desktop: collapsible aside, mobile: Sheet)
│   │   ├── sidebar-context.tsx  # React context for sidebar open/close state + ⌘+\ shortcut
│   │   ├── workspace-switcher.tsx # Dropdown listing all workspaces, create workspace trigger
│   │   ├── create-workspace-dialog.tsx # Dialog for creating a new workspace
│   │   ├── page-search.tsx      # Full-text search input + results dropdown (debounced, 300ms)
│   │   ├── favorites-section.tsx # Per-user favorites list + useFavorite hook for toggle
│   │   ├── focus-mode-hint.tsx  # Floating hint shown when sidebar is hidden in focus mode
│   │   ├── page-tree.tsx        # Orchestrator: data fetching, state, delete dialog (uses extracted sub-modules)
│   │   ├── page-tree-item.tsx  # Single tree node rendering + context menu
│   │   ├── page-tree-drag-layer.ts # usePageTreeDrag hook: drag-and-drop state + handlers
│   │   ├── use-page-tree-actions.ts # usePageTreeActions hook: CRUD operations (create, delete, duplicate, move, nest, favorites)
│   │   ├── trash-section.tsx    # Trash bin: lists soft-deleted pages, restore, permanent delete, empty trash
│   │   └── user-menu.tsx        # User dropdown with settings link + sign-out
│   ├── editor/                  # Lexical block editor
│   │   ├── editor.tsx               # Main editor: LexicalComposer, plugins, auto-save to Supabase
│   │   ├── theme.ts                 # EditorThemeClasses mapping Lexical nodes to Tailwind classes
│   │   ├── slash-command-plugin.tsx  # "/" typeahead: paragraph, h1-h3, lists, code, quote, divider, table, image, callout, toggle
│   │   ├── font-family.ts             # Font family options (sans-serif, serif, monospace) and CSS value mapping
│   │   ├── floating-toolbar-plugin.tsx # Selection toolbar: font family, bold, italic, underline, strikethrough, code, link
│   │   ├── floating-link-editor-plugin.tsx # Link preview/edit/remove popover (⌘+K)
│   │   ├── code-highlight-plugin.tsx # Registers Prism-based syntax highlighting for code blocks
│   │   ├── markdown-utils.ts        # Markdown ↔ Lexical conversion (export/import/download/parse)
│   │   ├── draggable-block-plugin.tsx # Drag handle + drop indicator for block reordering
│   │   ├── list-tab-indentation-plugin.tsx # Tab/Shift+Tab list indent/outdent
│   │   ├── image-node.tsx           # ImageNode (DecoratorNode) with caption, alignment, resize handles
│   │   ├── image-plugin.tsx         # Image upload to Supabase Storage, file drop handling
│   │   ├── floating-image-toolbar-plugin.tsx # Image toolbar: align, crop, expand, download
│   │   ├── image-expand-dialog.tsx  # Full-resolution image lightbox dialog
│   │   ├── image-crop-dialog.tsx    # Canvas-based image crop dialog with re-upload
│   │   ├── callout-node.tsx         # CalloutNode (ElementNode) with emoji + variant
│   │   ├── callout-plugin.tsx       # Callout insert command + emoji rendering
│   │   ├── collapsible-node.tsx     # CollapsibleContainer/Title/Content nodes (<details>/<summary>)
│   │   ├── page-link-node.tsx         # PageLinkNode (DecoratorNode) — inline page link pill with realtime title/icon updates
│   │   ├── page-link-plugin.tsx       # [[ trigger detection, page search dropdown, INSERT_PAGE_LINK_COMMAND
│   │   ├── collapsible-plugin.tsx   # Collapsible insert command + toggle handling
│   │   ├── table-action-menu-plugin.tsx # Table cell context menu (add/delete rows/columns)
│   │   ├── database-node.tsx        # DatabaseNode (DecoratorNode) — inline database embed
│   │   ├── database-plugin.tsx      # Database insert command + inline rendering
│   │   ├── turn-into-plugin.tsx     # Block transformation command (paragraph ↔ heading ↔ list ↔ quote ↔ code)
│   │   ├── turn-into-menu.tsx       # Floating menu UI for turn-into transformations
│   │   ├── auto-link-plugin.tsx     # Auto-detect URLs and emails, convert to links
│   │   ├── word-count-plugin.tsx    # Word count + reading time display below editor
│   │   ├── code-language-selector-plugin.tsx # Floating language picker for code blocks
│   │   ├── demo-editor.tsx          # Standalone demo editor for landing page (no Supabase, sessionStorage persistence)
│   │   ├── demo-slash-command-plugin.tsx # Slash commands for demo editor (excludes image, page-link, database)
│   │   └── local-persistence-plugin.tsx # Lexical plugin: persist editor state to sessionStorage (100KB cap)
│   ├── database/                # Database views system
│   │   ├── database-view-client.tsx     # Main client component: loads data, composes hooks + JSX
│   │   ├── database-view-helpers.tsx    # ViewConfigDropdown, ComingSoonPlaceholder, DatabaseSkeleton
│   │   ├── csv-export-button.tsx        # Download CSV toolbar button with relation title resolution
│   │   ├── database-search-input.tsx    # Search input for filtering rows by title substring
│   │   ├── hooks/                       # Domain hooks extracted from database-view-client
│   │   │   ├── use-database-views.ts    # View CRUD callbacks
│   │   │   ├── use-database-rows.ts     # Row mutations (deferred delete with undo, bulk delete)
│   │   │   ├── use-database-properties.ts # Property CRUD (deferred delete with undo)
│   │   │   ├── use-database-filters.ts  # Sort/filter state + displayedRows
│   │   │   └── use-row-selection.ts     # Row selection state: toggle, toggleAll, shift-range, clear
│   │   ├── view-tabs.tsx                # Horizontal tab bar for switching views
│   │   ├── filter-bar.tsx               # Active filter pills + add filter UI (composition only)
│   │   ├── filter-value-editor.tsx      # Type-specific filter value editors, property picker, operator picker
│   │   ├── sort-menu.tsx                # Sort configuration dropdown
│   │   ├── property-types/              # Registry of type-specific renderers and editors
│   │   ├── views/
│   │   │   ├── table-view.tsx           # Composition root — wires sub-components together, virtualizes rows >50
│   │   │   ├── table-row.tsx            # TableRow — title cell + property cells for one row (own grid when virtualized)
│   │   │   ├── table-cell.tsx           # TableCell + RegistryEditorCell — display/edit, portal editors
│   │   │   ├── table-column-header.tsx  # TableColumnHeader — sort, menu, drag, resize handle
│   │   │   ├── table-skeleton.tsx       # TableSkeleton — loading placeholder
│   │   │   ├── table-navigation.ts     # useTableCellNavigation hook — editing/focus/keyboard nav
│   │   │   ├── table-columns.ts        # useColumnResize + useColumnDragReorder hooks
│   │   │   ├── table-cell-renderer.tsx  # CellRenderer + SelectBadge — display-only value rendering
│   │   │   ├── table-keyboard.ts       # handleCellKeyDown — editing-mode key handler
│   │   │   ├── table-defaults.ts       # Pure helpers: value keys, select options, display values
│   │   │   ├── bulk-action-bar.tsx      # BulkActionBar — floating toolbar for bulk delete when rows selected
│   │   │   ├── row-count-status-bar.tsx # RowCountStatusBar — "X rows" / "X of Y rows" below the table
│   │   │   ├── row-count-announcer.tsx  # RowCountAnnouncer — sr-only aria-live region for row count changes
│   │   │   ├── database-empty-state.tsx # DatabaseEmptyState — shared empty state (no-rows vs filtered-empty)
│   │   │   ├── board-view.tsx           # Kanban columns grouped by select property
│   │   │   ├── board-view-helpers.ts    # Pure grouping/DnD logic extracted from board-view
│   │   │   ├── board-keyboard.ts        # useBoardKeyboardNavigation — arrow key nav for board cards
│   │   │   ├── list-view.tsx            # Compact vertical list
│   │   │   ├── list-keyboard.ts         # useListKeyboardNavigation — arrow/Home/End key nav for list rows
│   │   │   ├── calendar-keyboard.ts     # Keyboard navigation hook for calendar grid
│   │   │   ├── calendar-view.tsx        # Month grid with date-positioned items
│   │   │   ├── calendar-view-helpers.ts # Pure date/grid logic extracted from calendar-view
│   │   │   ├── gallery-view.tsx         # Responsive card grid with cover + title
│   │   │   └── gallery-keyboard.ts     # useGalleryKeyboardNavigation — arrow key nav for gallery cards
│   │   ├── property-type-picker.tsx      # Dropdown menu for selecting property type when adding columns
│   │   ├── rename-property-dialog.tsx   # Styled dialog replacing window.prompt for column rename
│   │   └── row-properties-header.tsx    # Properties displayed above editor when row opened as page
│   ├── feedback/
│   │   └── feedback-form.tsx        # User feedback form with type selector, screenshot capture, and submission
│   ├── keyboard-shortcuts-dialog.tsx # ⌘+? keyboard shortcuts reference dialog
│   ├── providers.tsx                # Client-side providers wrapper (ThemeProvider, Toaster, TooltipProvider)
│   ├── landing-demo-editor.tsx      # Client wrapper: lazy-loads DemoEditor via next/dynamic for landing page
│   ├── account-page-client.tsx   # Client wrapper: lazy-loads ChangePasswordSection + DeleteAccountSection via React.lazy
│   ├── account-settings-form.tsx # Account settings: display name edit, avatar upload (saves to profiles + auth metadata)
│   ├── change-password-section.tsx # Password change form (new + confirm, calls updateUser)
│   ├── delete-account-section.tsx # Account deletion danger zone with double-confirm dialog
│   ├── emoji-picker.tsx         # Floating emoji grid with search, used by page icon picker
│   ├── page-cover.tsx           # Page cover image: upload, display, change, remove (saves to pages.cover_url)
│   ├── page-icon.tsx            # Page icon display + emoji picker trigger (saves to pages.icon)
│   ├── page-title.tsx           # Inline-editable page title (saves on blur/Enter)
│   ├── page-breadcrumb.tsx       # Server component: breadcrumb nav (workspace → ancestors → current page)
│   ├── page-backlinks.tsx        # Server component: backlinks section (queries page_links, shows linking pages)
│   ├── page-content-client.tsx   # Client wrapper: lazy-loads DatabaseViewClient, RowPropertiesHeader, PageViewClient via next/dynamic
│   ├── page-view-client.tsx     # Client wrapper for page view (holds editor ref, renders icon + title + menu + editor)
│   ├── page-menu.tsx            # Page "..." dropdown: favorites, duplicate, version history, export/import markdown
│   ├── version-history-panel.tsx # Sheet panel: lists page versions, preview, restore
│   ├── relative-time.tsx        # Client component for "2 hours ago" timestamps (avoids hydration mismatch)
│   ├── route-error.tsx          # Reusable error boundary UI (Sentry capture + retry button)
│   ├── lazy-route-error.tsx    # Dynamic-import wrapper for route-error (keeps error boundary JS out of first load)
│   ├── workspace-home.tsx       # Workspace home: page list or empty state with create CTA
│   ├── workspace-home-client.tsx # Client wrapper: lazy-loads WorkspaceHome via next/dynamic
│   ├── settings-page-client.tsx  # Client wrapper: lazy-loads SettingsPageContent via next/dynamic
│   ├── settings-page-content.tsx # Settings page layout: form + change password + danger zone
│   ├── workspace-settings-form.tsx # Edit workspace name/slug, lazy-loads delete workspace section
│   ├── delete-workspace-section.tsx # Workspace deletion danger zone with AlertDialog confirmation
│   ├── danger-zone-settings.tsx # Client wrapper: lazy-loads DeleteAccountSection via next/dynamic
│   ├── members/             # Workspace member management components
│   │   ├── members-page.tsx       # Client orchestrator: member list + invite form + pending invites
│   │   ├── members-page-client.tsx # Client wrapper: lazy-loads MembersPage via next/dynamic
│   │   ├── member-list.tsx        # Table of members with role badges, role change, remove
│   │   ├── invite-form.tsx        # Email + role invite form (admin/owner only)
│   │   ├── invite-accept.tsx      # Client component for accepting an invite token
│   │   ├── pending-invite-list.tsx # Table of pending invites with revoke + copyable invite link
│   │   └── role-select.tsx        # Role picker dropdown (owner/admin/member)
│   └── ui/                 # shadcn/ui components (base-nova style, base-ui primitives)
│       ├── alert-dialog.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── context-menu.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── table.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── lib/
│   ├── capture.ts          # lazyCaptureException — dynamic import of Sentry to reduce bundle size
│   ├── column-helpers.ts    # Pure helpers for column-add flow: name generation, config seeding, concurrency guard
│   ├── csv-export.ts       # CSV serialization (RFC 4180) and download trigger for database export
│   ├── database.ts         # Database CRUD: create/delete databases, property/row/view CRUD, data loading
│   ├── database-cache.ts   # In-memory cache for database data and workspace members
│   ├── database-filters.ts # Client-side filter engine for database views (text, number, date, select, etc.)
│   ├── formula.ts          # Formula parser and evaluator for formula property type
│   ├── page-tree.ts        # Pure functions: tree building, reorder, nest/unnest, drop computation
│   ├── property-icons.ts   # Shared PropertyType → icon + label mapping for database components
│   ├── rate-limit.ts       # In-memory sliding window rate limiter (withRateLimit wrapper for API routes)
│   ├── retry.ts            # retryOnNetworkError helper (exponential backoff for transient failures)
│   ├── sentry.ts           # captureSupabaseError helper (structured Sentry reporting)
│   ├── theme.tsx            # ThemeProvider + useTheme hook (light/dark/system, localStorage persistence)
│   ├── toast.ts            # Lazy-loaded sonner toast wrapper to reduce initial bundle size
│   ├── track-event.ts      # Client-side usage event tracking (trackEventClient)
│   ├── track-event-server.ts # Server-side usage event tracking (trackEvent)
│   ├── types.ts            # Database entity types
│   ├── usage-tracking-guard.ts # isUsageTrackingDisabled — suppresses usage events in CI/test
│   ├── use-media-query.ts  # Hook for reactive CSS media query matching (useSyncExternalStore)
│   ├── use-persisted-expanded.ts # Hook for persisting sidebar tree expansion state to localStorage
│   ├── use-screenshot.ts   # Hook for capturing screenshots via html2canvas (feedback form)
│   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── word-count.ts       # Word count and reading time calculation utilities
│   ├── workspace.ts        # Workspace utilities: slug generation, validation, limits
│   └── supabase/
│       ├── admin.ts        # Service-role client for server-only operations (cron jobs)
│       ├── client.ts       # Browser client (createBrowserClient)
│       ├── lazy-client.ts  # Lazy-loaded browser client (defers SDK import to reduce initial bundle)
│       ├── server.ts       # Server component client (createServerClient + cookies)
│       └── proxy.ts        # Session refresh + auth redirect logic (updateSession)
├── proxy.ts                # Root proxy — calls updateSession, skips static/health routes
└── instrumentation.ts      # Sentry server/edge init (register + onRequestError)

scripts/
├── check-bundle.mjs           # Bundle budget check (per-route + framework baseline)
├── tweet.ts                   # Post a tweet to @swfactory_dev via Twitter API v2
└── metrics/
    └── build-timeseries.mjs   # Build metrics timeseries from daily snapshots (with tests)

docs/
├── product-spec.md            # Product specification
├── bundle-budget.md           # Chunk inventory, splitting strategy, budget guidelines
├── automations.md             # Complete automation reference with prompts and label conventions

Root config files:
├── instrumentation-client.ts  # Sentry client init (replay, route transitions)
├── sentry.server.config.ts    # Sentry server SDK config
├── sentry.edge.config.ts      # Sentry edge SDK config
└── components.json            # shadcn/ui config (base-nova style, Tailwind v4)
```

## Observability

- **Sentry client**: session replay (10% normal, 100% on error), route transition tracking
- **Sentry server**: PII enabled, local variables, 10% trace sampling in production
- **Health endpoint**: `GET /api/health` — checks DB connectivity, returns status + latency
