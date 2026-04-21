# Memo — Product Specification

## Vision

A clean, fast workspace with block-based editing. Think Notion,
but minimal and keyboard-first. Built entirely via automated agent loops.

## Target Users

Developers and small teams who want a lightweight workspace for notes,
documentation, and project planning.

## Design Direction

- Minimal UI — content takes center stage
- Keyboard-first interaction model
- Slash commands for block insertion
- Clean typography with generous whitespace
- Smooth transitions, no jarring state changes
- Dark mode only (see `.agents/design.md` for full visual spec)

## Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor | Lexical (Meta, MIT) | Full control, MIT license, Meta-backed. Build from the lexical-playground reference, adapting to Next.js 16 + Tailwind + shadcn/ui. See `.agents/architecture.md` for implementation details. |
| Content storage | Lexical JSON in PostgreSQL `jsonb` | `editorState.toJSON()` → stored in `pages.content`. On load: `editor.parseEditorState(json)`. |
| Auth | Supabase Auth (email/password) | OAuth (GitHub, Google) deferred — buttons rendered with "coming soon" tooltip. |
| Realtime collaboration | Deferred to post-MVP | Yjs + Supabase Realtime adds significant complexity. Ship single-user editing first. |
| Workspace model | Personal + team workspaces | Every user gets a personal workspace on sign-up. Users can create up to 2 additional workspaces (3 total). Invited workspaces are unlimited. |
| Access control | Row Level Security (RLS) on all tables | Policies enforce workspace membership for all operations. |
| Styling | Tailwind v4 + shadcn/ui | No custom CSS. See `.agents/design.md`. |

## Scope

### In Scope (MVP)

1. **Auth** — sign up, sign in, sign out, session management (email/password). GitHub + Google buttons visible but disabled with "coming soon" tooltip.
2. **Workspaces** — personal workspace auto-created on sign-up (non-deletable, always listed first, named "{display_name}'s Workspace"). Users can create up to 2 additional workspaces (3 total including personal). Workspace settings, workspace switcher.
3. **Pages** — create, read, update, delete, list. Nested sub-pages (parent/child hierarchy).
4. **Editor** — Lexical-based block editor with:
   - Block types: paragraph, heading (1-3), bullet list, numbered list, todo/checklist, code block, blockquote, divider, callout, image
   - Slash command menu (`/` to insert blocks)
   - Floating text format toolbar (bold, italic, underline, strikethrough, code, link)
   - Drag-and-drop block reordering
   - Keyboard shortcuts
   - Content stored as Lexical JSON in PostgreSQL via Supabase
5. **Search** — full-text search across page titles and content within a workspace.
6. **Import/Export** — Markdown import (create page from .md file) and export (download page as .md).
7. **Members** — workspace owner/admin can invite users by email, roles (owner, admin, member), remove members. Users can be members of unlimited workspaces via invites.
8. **App shell** — sidebar with page tree, workspace switcher, search, user menu. Responsive (sidebar collapses on mobile).

### Post-MVP: Database Views

9. **Database views** — Notion-style databases with structured properties, multiple view types, and rows-as-pages. Databases are special pages (`is_database = true`) that can also be embedded inline via a Lexical `DatabaseNode`. Full spec in `spec.md`.
   - **View types**: Table, Board (Kanban), List, Calendar (month grid), Gallery (card grid)
   - **Property types**: text, number, select, multi-select, checkbox, date, URL, email, phone, person, files, relation, formula, created_time, updated_time, created_by
   - **Features**: multiple named views per database, sort by any property, filter with type-appropriate operators (AND-combined), inline cell editing, row opens as full page with Lexical editor
   - **Inline databases**: `DatabaseNode` (Lexical DecoratorNode) embeds a database view inside any page, with expand-to-full-page

### Out of Scope

- Realtime collaboration (live cursors, co-editing) — post-MVP via Yjs
- Third-party integrations (Slack, GitHub, etc.)
- AI writing features
- Offline support
- Mobile native apps
- Light mode
- Comments on pages

## Data Model

```
profiles
  id: uuid (references auth.users.id)
  email: text
  display_name: text
  avatar_url: text (nullable)
  created_at: timestamptz

workspaces
  id: uuid (PK)
  name: text
  slug: text (unique)
  is_personal: boolean (default false — true for the auto-created personal workspace)
  created_by: uuid (references profiles.id)
  created_at: timestamptz
  updated_at: timestamptz

  Constraints:
  - Personal workspaces (is_personal = true): cannot be deleted, always listed first in UI
  - Workspace creation limit: max 3 workspaces per user where created_by = user.id (enforced via DB function + RLS)
  - One personal workspace per user: UNIQUE(created_by) WHERE is_personal = true

members
  id: uuid (PK)
  workspace_id: uuid (references workspaces.id, on delete cascade)
  user_id: uuid (references profiles.id, on delete cascade)
  role: text (owner | admin | member)
  invited_by: uuid (references profiles.id, nullable)
  invited_at: timestamptz
  joined_at: timestamptz (nullable — null means pending invite)
  created_at: timestamptz
  UNIQUE(workspace_id, user_id)

workspace_invites
  id: uuid (PK)
  workspace_id: uuid (references workspaces.id, on delete cascade)
  email: text
  role: text (admin | member)
  invited_by: uuid (references profiles.id)
  token: text (unique, for invite link)
  expires_at: timestamptz
  accepted_at: timestamptz (nullable)
  created_at: timestamptz

pages
  id: uuid (PK)
  workspace_id: uuid (references workspaces.id, on delete cascade)
  parent_id: uuid (references pages.id, on delete cascade, nullable)
  title: text (default '')
  content: jsonb (Lexical editor state JSON)
  icon: text (emoji, nullable)
  is_database: boolean (default false — when true, page acts as a database container)
  position: integer (ordering among siblings)
  created_by: uuid (references profiles.id)
  created_at: timestamptz
  updated_at: timestamptz

  When is_database = true:
  - Child pages (parent_id = this page) are database rows
  - database_properties defines the schema (columns)
  - database_views defines saved views (table, board, list, calendar, gallery)
  - Regular page features (icon, cover, content) still work — content renders above the database grid

database_properties (schema definition — columns of a database)
  id: uuid (PK)
  database_id: uuid (references pages.id, on delete cascade)
  name: text (not null)
  type: text (not null — text | number | select | multi_select | checkbox | date | url | email | phone | person | files | relation | formula | created_time | updated_time | created_by)
  config: jsonb (type-specific: select options, number format, formula expression, relation target)
  position: integer (column ordering)
  created_at: timestamptz
  updated_at: timestamptz
  UNIQUE(database_id, name)

database_views (saved views on a database)
  id: uuid (PK)
  database_id: uuid (references pages.id, on delete cascade)
  name: text (not null, default 'Default view')
  type: text (not null — table | board | list | calendar | gallery)
  config: jsonb (visible_properties, sorts, filters, plus type-specific config)
  position: integer (view tab ordering)
  created_at: timestamptz
  updated_at: timestamptz

row_values (property values for each database row)
  id: uuid (PK)
  row_id: uuid (references pages.id, on delete cascade — the row page)
  property_id: uuid (references database_properties.id, on delete cascade)
  value: jsonb (format depends on property type)
  created_at: timestamptz
  updated_at: timestamptz
  UNIQUE(row_id, property_id)
```

All tables have RLS enabled. Policies enforce workspace membership for all operations.

## Feature Priority (Implementation Order)

Each feature maps to one or more GitHub Issues. Phases map to priority labels:
- **Phase 1** → `priority:1` (foundation — nothing else works without this)
- **Phase 2** → `priority:2` (core features — the product's value)
- **Phase 3** → `priority:3` (features and polish)

### Phase 1: Foundation (`priority:1`)

1. **Database schema** — migrations for profiles, workspaces, members, workspace_invites, pages tables with RLS policies. Include `handle_new_user` trigger that creates profile + personal workspace + owner membership atomically on sign-up. _No dependencies._
2. **Auth flow** — sign up, sign in, sign out pages. Email/password via Supabase Auth. After sign-up, user lands in their personal workspace. GitHub/Google buttons with "coming soon" tooltip. _Depends on: #1 (Database schema)._
3. **App shell** — authenticated layout with sidebar, workspace context, responsive behavior. JetBrains Mono font. Dark mode only. Sharp corners per design spec. Route groups: `(auth)/` for sign-in/sign-up, `(app)/` for authenticated routes with `[workspaceSlug]/` dynamic segment. _Depends on: #2 (Auth flow)._

### Phase 2: Core Product (`priority:2`)

4. **Workspace CRUD** — create additional workspaces (up to 2 beyond personal, 3 total), workspace settings (name, slug), workspace switcher (personal always first), delete workspace (non-personal only). _Depends on: #3 (App shell)._
5. **Pages CRUD** — create, list, read, update, delete pages. Sidebar page tree with nesting. Reorder and nest/unnest pages. Route: `(app)/[workspaceSlug]/[pageId]/page.tsx`. _Depends on: #4 (Workspace CRUD)._
6. **Lexical editor — core** — editor with paragraph, headings, lists, code blocks, blockquotes, divider. Slash command menu (ComponentPickerPlugin). Floating text format toolbar (FloatingTextFormatToolbarPlugin). Floating link editor (FloatingLinkEditorPlugin). Auto-save to Supabase (debounced). _Depends on: #5 (Pages CRUD)._
7. **Lexical editor — enhancements** — drag-and-drop block reordering (DraggableBlockPlugin), image upload via Supabase Storage (ImagesExtension), callout blocks (CalloutNode), toggle/collapsible blocks (CollapsibleExtension), keyboard shortcuts. _Depends on: #6 (Lexical editor — core)._

### Phase 3: Features (`priority:3`)

8. **Search** — full-text search across page titles and content within a workspace. Search UI in sidebar. PostgreSQL `tsvector`/`tsquery`. _Depends on: #5 (Pages CRUD)._
9. **Import/Export** — Markdown import (upload .md → create page) and export (page → download .md). Uses `@lexical/markdown` transforms. _Depends on: #6 (Lexical editor — core)._
10. **Members** — invite users by email, accept invite flow, role management (owner, admin, member), remove members. Only owner/admin can manage members. _Depends on: #4 (Workspace CRUD)._

### Phase 4: Database Views — Foundation (`priority:1`)

11. **Database schema migration** — Add `is_database` to pages, create `database_properties`, `database_views`, `row_values` tables with RLS. _No dependencies beyond existing schema._
12. **Database CRUD operations** — Create/delete/rename databases. Property CRUD, row CRUD, view CRUD via Supabase. _Depends on: #11._
13. **Table view component** — Spreadsheet grid with column headers, inline cell editing, add row/column, column resize. _Depends on: #12._
14. **Property type renderers & editors** — Cell renderer and editor for: text, number, select, multi-select, checkbox, date, URL, email, phone. Registry pattern for extensibility. _Depends on: #12._
15. **Database page detection & routing** — `[pageId]/page.tsx` detects `is_database`, renders database view. View tabs UI. _Depends on: #13._
16. **Row-as-page support** — Clicking a row opens full page with properties header + Lexical editor. _Depends on: #14, #15._

### Phase 5: Database Views — Additional Views (`priority:2`)

17. **Sort & filter engine** — Client-side sort/filter on row data. Filter bar UI. Persisted per-view. _Depends on: #13._
18. **Board view component** — Kanban grouped by select property. Drag cards between columns. _Depends on: #14, #17._
19. **List view component** — Compact row list with title + visible properties. _Depends on: #14, #17._
20. **Multi-view management** — Create, rename, delete, reorder views. View type picker. Independent config per view. _Depends on: #17._

### Phase 6: Database Views — Advanced (`priority:2`)

21. **Calendar view component** — Month grid, items on date cells, prev/next navigation. _Depends on: #14, #17._
22. **Gallery view component** — Responsive card grid with cover image + title. _Depends on: #14, #17._
23. **Person property type** — Member avatar picker, stores user IDs. _Depends on: #14._
24. **Files property type** — Upload to Supabase Storage, render thumbnails. _Depends on: #14._
25. **Relation property type** — Link rows across databases, render as pills. _Depends on: #14._

### Phase 7: Database Views — Inline & Formulas (`priority:3`)

26. **DatabaseNode (inline database block)** — Lexical DecoratorNode, slash command, compact view, expand button. _Depends on: #15, #20._
27. **Formula property type** — Simple expression parser: math, string concat, if/else, now(), date math, prop() refs. _Depends on: #14._
28. **Database in sidebar** — Grid icon for database pages, "New Database" in sidebar create menu. _Depends on: #15._

## Acceptance Criteria

These criteria are used by the Feature Planner to create GitHub Issues and by the Feature Builder to verify implementation.

### Auth
- [ ] User can sign up with email/password
- [ ] User can sign in with email/password
- [ ] User can sign out
- [ ] Session persists across page reloads (proxy refreshes token)
- [ ] GitHub and Google buttons are visible but show "coming soon" tooltip on hover/click
- [ ] On sign-up: profile + personal workspace + owner membership created atomically (DB trigger/function)
- [ ] After sign-up, user lands in their personal workspace (not a "create workspace" prompt)
- [ ] Unauthenticated users are redirected to sign-in page

### Workspaces
- [ ] Personal workspace is auto-created on sign-up, named "{display_name}'s Workspace"
- [ ] Personal workspace is always listed first in the workspace switcher
- [ ] Personal workspace cannot be deleted (delete option hidden or disabled with explanation)
- [ ] User can create up to 2 additional workspaces (3 total including personal)
- [ ] When workspace limit is reached, "Create workspace" button is disabled with message showing limit
- [ ] Workspace creation limit is enforced server-side (DB function rejects insert if count ≥ 3)
- [ ] User can switch between workspaces via sidebar
- [ ] Workspace settings page (name, slug)
- [ ] Deleting a non-personal workspace cascades to all pages and members
- [ ] Users invited to workspaces do not count those toward their creation limit

### Pages
- [ ] User can create a new page (from sidebar)
- [ ] Pages appear in sidebar tree with nesting
- [ ] User can rename a page (inline title editing)
- [ ] User can delete a page (with confirmation)
- [ ] User can reorder pages in the sidebar (drag-and-drop or move-to)
- [ ] User can nest/unnest pages (make sub-page, move to root)
- [ ] Empty state when workspace has no pages

### Editor
- [ ] Block types: paragraph, heading 1-3, bullet list, numbered list, todo list, code block, blockquote, divider, callout, image
- [ ] Slash command menu triggered by `/` — filterable, keyboard navigable
- [ ] Floating toolbar on text selection — bold, italic, underline, strikethrough, code, link
- [ ] Drag-and-drop block reordering with visual indicator
- [ ] Auto-save: content persists to Supabase on change (debounced)
- [ ] Page loads with saved content restored
- [ ] Placeholder text in empty blocks ("Type '/' for commands")
- [ ] Code blocks have syntax highlighting
- [ ] Images can be uploaded and displayed inline
- [ ] Keyboard shortcuts: ⌘+B (bold), ⌘+I (italic), ⌘+U (underline), ⌘+K (link), ⌘+Z (undo), ⌘+Shift+Z (redo)

### Search
- [ ] Search input in sidebar
- [ ] Results show matching page titles and content snippets
- [ ] Clicking a result navigates to the page
- [ ] Search is scoped to the current workspace
- [ ] Empty state when no results found

### Import/Export
- [ ] User can export a page as Markdown (.md file download)
- [ ] User can import a Markdown file to create a new page
- [ ] Import preserves headings, lists, code blocks, links, images (as URLs)

### Members
- [ ] Workspace owner or admin can invite users by email
- [ ] Only owner/admin roles can manage members (member role cannot invite or remove)
- [ ] Invited user receives an invite (in-app notification or email link)
- [ ] Invited user can accept and join the workspace (no limit on joined workspaces)
- [ ] Roles: owner (full control), admin (manage members + pages), member (read/write pages)
- [ ] Owner/admin can change member roles
- [ ] Owner/admin can remove members
- [ ] Member list visible in workspace settings
- [ ] Personal workspace owner cannot be removed from their own personal workspace

### Database Views
- [ ] User can create a database from the sidebar ("New Database" button)
- [ ] Database pages show a grid icon in the sidebar page tree
- [ ] User can define properties (columns) with name and type
- [ ] User can add, edit, and delete rows in table view
- [ ] Inline cell editing works for all basic property types
- [ ] Select/multi-select properties support creating new options inline
- [ ] Database page shows optional rich text content above the database grid
- [ ] Clicking a row opens it as a full page with properties header + Lexical editor
- [ ] Row page shows breadcrumb: workspace → database → row
- [ ] Created time, Updated time, Created by properties auto-derive from page metadata
- [ ] User can create multiple views per database (table, board, list, calendar, gallery)
- [ ] View tabs appear above the database, active view highlighted
- [ ] Each view stores independent configuration (visible properties, sort, filter)
- [ ] Table view: resizable columns, column reorder, add row/column
- [ ] Board view: Kanban grouped by select property, drag cards between columns
- [ ] List view: compact rows with title + visible properties
- [ ] Calendar view: month grid, items on date cells, prev/next month navigation
- [ ] Gallery view: card grid with cover image + title
- [ ] User can sort by any property (ascending/descending), multiple sort rules
- [ ] User can filter by property value with type-appropriate operators
- [ ] Active filters shown as pills in filter bar, persisted per-view
- [ ] User can insert a database block via slash command (`/database`)
- [ ] Inline database renders a compact view with expand-to-full-page button
- [ ] Person property shows member avatars, picker searches workspace members
- [ ] Files property supports upload and renders thumbnails
- [ ] Relation property links to rows in another database, renders as pills
- [ ] Formula property evaluates simple expressions referencing other properties
- [ ] All database data respects workspace RLS policies

### App Shell
- [ ] Sidebar: workspace switcher, search, page tree, settings, user menu
- [ ] Sidebar collapses on mobile (Sheet component)
- [ ] Responsive: works on desktop (≥1024px), tablet (768-1023px), mobile (<768px)
- [ ] Keyboard shortcut: ⌘+\ to toggle sidebar
- [ ] Dark mode only (per design spec)
- [ ] JetBrains Mono font throughout
- [ ] Sharp corners on all components (per design spec)

## URL Structure

```
/sign-in                          → (auth)/sign-in/page.tsx
/sign-up                          → (auth)/sign-up/page.tsx
/                                 → redirect to personal workspace
/[workspaceSlug]                  → (app)/[workspaceSlug]/page.tsx (workspace home / page list)
/[workspaceSlug]/[pageId]         → (app)/[workspaceSlug]/[pageId]/page.tsx (page editor OR database view when is_database=true)
/[workspaceSlug]/[pageId]?view=x  → database with specific view selected
/[workspaceSlug]/settings         → (app)/[workspaceSlug]/settings/page.tsx (workspace settings)
/[workspaceSlug]/settings/members → (app)/[workspaceSlug]/settings/members/page.tsx
/invite/[token]                   → (auth)/invite/[token]/page.tsx (accept workspace invite)
```

Route groups:
- `(auth)` — unauthenticated routes (sign-in, sign-up, invite acceptance)
- `(app)` — authenticated routes with shared layout (sidebar + main content area)

## Technical Notes

Implementation hints for the Feature Builder. Reference `.agents/architecture.md` for the full system design and `.agents/conventions.md` for coding patterns.

- **Lexical packages**: install from npm (`lexical`, `@lexical/react`, `@lexical/rich-text`, `@lexical/list`, `@lexical/code`, `@lexical/link`, `@lexical/selection`, `@lexical/utils`, `@lexical/markdown`, `@lexical/clipboard`). Pin to a specific version to avoid breaking changes.
- **Lexical playground reference**: build custom plugins (slash commands, drag-and-drop, floating toolbar, images, callouts) referencing `facebook/lexical/packages/lexical-playground/src/plugins/`. Do NOT fork the playground — adapt patterns to Tailwind + shadcn/ui. See `.agents/architecture.md` for the full plugin plan.
- **Floating UI**: use `@floating-ui/react` for positioning slash command menu, floating toolbar, and link editor.
- **Image storage**: Supabase Storage bucket for uploaded images. Store the public URL in the ImageNode.
- **Full-text search**: PostgreSQL `tsvector` + `tsquery` on page title and a text extraction of content JSON. Create a generated column or trigger to maintain the search index.
- **Auto-save**: debounce editor changes (500ms), write to Supabase. Show save indicator in UI.
- **Markdown transforms**: `@lexical/markdown` provides `$convertFromMarkdownString` and `$convertToMarkdownString` with configurable transformers.
- **Personal workspace creation**: Use a Supabase DB trigger on `auth.users` insert (or a `handle_new_user` function) that creates the profile, workspace (`is_personal = true`), and owner membership row atomically.
- **Workspace creation limit**: Enforce via a PostgreSQL `BEFORE INSERT` trigger on `workspaces` that checks `SELECT count(*) FROM workspaces WHERE created_by = NEW.created_by` and raises an exception if ≥ 3. Also enforce client-side by disabling the "Create workspace" button when the count is reached.
- **Personal workspace protection**: RLS policy on `workspaces` prevents `DELETE` where `is_personal = true`. The UI hides the delete option for personal workspaces.
- **Database rows are pages**: each row in a database is a child page (`parent_id` = database page ID). This means search, favorites, trash, version history, and backlinks work on database rows automatically.
- **Property type registry**: implement as `Record<PropertyType, { Renderer, Editor }>` so new types can be added without modifying view components.
- **Client-side filtering/sorting**: load all rows and filter/sort in the browser for the initial implementation. Server-side filtering deferred until databases grow large.
- **Calendar view**: build with Tailwind grid, no external calendar library.
- **Formula evaluation**: simple recursive descent parser on the client. Evaluate at render time, not stored.
- **Select option colors**: fixed palette of 8-10 muted colors derived from the design token set.
- **DatabaseNode**: Lexical DecoratorNode referencing a database page ID. Renders compact view inline, expand icon opens full page.
