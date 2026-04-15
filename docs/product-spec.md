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

### Out of Scope (MVP)

- Realtime collaboration (live cursors, co-editing) — post-MVP via Yjs
- Database views / tables (Notion-style databases)
- Third-party integrations (Slack, GitHub, etc.)
- AI writing features
- Offline support
- Mobile native apps
- Light mode
- Comments on pages
- Version history
- OAuth providers (GitHub, Google) — buttons shown but non-functional

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
  position: integer (ordering among siblings)
  created_by: uuid (references profiles.id)
  created_at: timestamptz
  updated_at: timestamptz
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
7. **Lexical editor — enhancements** — extends the core editor with advanced block interactions:
   - **Drag-and-drop** (DraggableBlockPlugin): 6-dot grip handle visible on block hover, 2px accent drop indicator, blocks at 50% opacity while dragging. Reference: `playground/plugins/DraggableBlockPlugin`.
   - **Image blocks** (ImagesExtension): upload images to Supabase Storage bucket, display inline with optional caption, max-width 100%. Custom `ImageNode` (DecoratorNode) stores the public URL. Reference: `playground/plugins/ImagesExtension`.
   - **Callout blocks** (CalloutNode): `bg-muted p-4` container with emoji on the left and rich text on the right. Custom `CalloutNode` (ElementNode). Add to slash command menu.
   - **Toggle/collapsible blocks** (CollapsibleExtension): expandable container with a disclosure triangle and summary text. Reference: `playground/plugins/CollapsibleExtension`. Add to slash command menu.
   - **Keyboard shortcuts**: ⌘+B (bold), ⌘+I (italic), ⌘+U (underline), ⌘+K (link), ⌘+Z (undo), ⌘+Shift+Z (redo). Display shortcut hints in toolbar tooltips and slash command menu items. Detect OS for ⌘ vs Ctrl.
   _Depends on: #6 (Lexical editor — core)._

### Phase 3: Features (`priority:3`)

8. **Search** — full-text search across page titles and content within a workspace. Search UI in sidebar. PostgreSQL `tsvector`/`tsquery`. _Depends on: #5 (Pages CRUD)._
9. **Import/Export** — Markdown import (upload .md → create page) and export (page → download .md). Uses `@lexical/markdown` transforms. _Depends on: #6 (Lexical editor — core)._
10. **Members** — invite users by email, accept invite flow, role management (owner, admin, member), remove members. Only owner/admin can manage members. _Depends on: #4 (Workspace CRUD)._

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
/[workspaceSlug]/[pageId]         → (app)/[workspaceSlug]/[pageId]/page.tsx (page editor)
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
