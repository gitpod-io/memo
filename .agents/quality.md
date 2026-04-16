# Quality Grades

Updated weekly by the Automation Auditor. Tracks code quality per domain.

## Grading Scale

- **A** — Well-tested, clean patterns, no known issues
- **B** — Functional, minor test gaps or inconsistencies
- **C** — Works but needs attention — missing tests, unclear patterns
- **D** — Significant issues — bugs, no tests, inconsistent patterns
- **-** — Not yet implemented

## Current Grades

| Domain | Grade | Notes |
|---|---|---|
| Infrastructure | A | Sentry (client + server + edge), proxy with session refresh, health endpoint with tests (6 tests), PWA manifest, global error boundary, Supabase clients (browser + server + proxy). JetBrains Mono font correctly configured. Dark-only oklch theme tokens. |
| Auth | B | Sign-in, sign-up, invite accept pages. OAuth buttons rendered with "coming soon" tooltip. Auth guard in app layout with redirect. Typography regression test (2 tests). E2E spec covers form rendering, redirect, and sign-in flow (4 tests). No unit tests for form validation logic. |
| Workspaces | B | Workspace home, settings (name/slug/delete), workspace switcher with create dialog. Slug generation utility with unit tests (12 tests). E2E spec covers workspace creation and settings (3 tests). Max 3 workspace limit enforced via DB trigger. No unit tests for settings form or workspace-home component. |
| Pages | B | Page view with title + editor, page tree with CRUD + drag-and-drop + nest/unnest. Page menu with export/import markdown. E2E specs for page CRUD (7 tests) and sidebar drag (3 tests). Page tree is 836 lines — largest component, complex but well-structured with Sentry error capture throughout. No unit tests for page-tree logic. |
| Editor | A | Full Lexical editor: slash commands, floating toolbar, floating link editor, drag-and-drop blocks, code highlighting, image upload, callouts, collapsible/toggle blocks. Markdown import/export. 4 unit test files (24 tests): theme mapping, markdown utils, design spec compliance, Node.contains safety. 4 E2E specs (editor-drag, editor-link, editor-slash-commands, editor-toolbar). Auto-save with debounce. Sentry error capture on save failures and image uploads. |
| Search | B | Full-text search via PostgreSQL tsvector + tsquery. API route with integration tests (8 tests). Sidebar search component with debounced input (300ms) and results dropdown. Sentry error capture. No E2E test for search interaction. |
| Import/Export | B | Markdown export (download .md) and import (parse .md, create page) via page menu. Markdown utils with unit tests (8 tests). No E2E test for import/export flow. |
| Members | A | Member list with role badges, role change, remove. Invite form (email + role). Pending invite list with revoke. Invite accept page. Role select dropdown. Settings members page with server-side data fetching. Full E2E coverage: invite, pending list, revoke, accept, role change, remove, member role restrictions. |
| App Shell | B | Collapsible sidebar (desktop: aside, mobile: Sheet), sidebar context with ⌘+\ shortcut, workspace switcher, page tree, user menu with sign-out. Clean component decomposition. No unit tests for sidebar context or app shell layout. |
| API Routes | A | Health endpoint (DB connectivity check, 6 tests) and search endpoint (full-text search, 8 tests). Both routes have Sentry error capture. Both have integration tests with mocked Supabase. |
| UI Components | A | 13 shadcn/ui components (base-nova style): alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, table, tooltip. Overlay opacity regression test (2 tests). Toast error duration regression test (1 test). Design tokens use oklch color space, --radius: 0 for sharp corners. |
| Realtime | - | Deferred to post-MVP per architecture decision. |

## Test Coverage Summary

| Category | Files | Tests |
|---|---|---|
| Unit/Integration (Vitest) | 11 | 58 |
| E2E (Playwright) | 8 | ~30+ |
| **Total** | **19** | **~88+** |

### Test files by domain

- **Auth**: `auth-typography.test.ts` (2 tests), `e2e/auth.spec.ts`
- **Workspaces**: `workspace.test.ts` (12 tests), `e2e/workspace.spec.ts`
- **Editor**: `theme.test.ts` (9), `markdown-utils.test.ts` (8), `design-spec-compliance.test.ts` (7), `node-contains-safety.test.ts` (1), `e2e/editor-drag.spec.ts`, `e2e/editor-link.spec.ts`, `e2e/editor-slash-commands.spec.ts`, `e2e/editor-toolbar.spec.ts`
- **Pages**: `e2e/page-crud.spec.ts`, `e2e/sidebar-drag.spec.ts`
- **Search**: `route.test.ts` (8 tests)
- **API**: `health/route.test.ts` (6 tests), `search/route.test.ts` (8 tests)
- **UI**: `overlay-opacity.test.ts` (2 tests), `toast-error-duration.test.ts` (1 test)
- **Lib**: `sentry.test.ts` (2 tests)

## Known Gaps

- **Members**: Full E2E coverage added (7 tests). Disambiguated Supabase join bug fixed in members page and invite form.
- **Search UI**: No E2E test for the sidebar search interaction (typing, results display, navigation).
- **Import/Export**: No E2E test for markdown export/import flow via page menu.
- **Page tree**: No unit tests for the tree manipulation logic (nest, unnest, reorder). The component is 836 lines — extracting tree logic into a utility would improve testability.
- **Workspace settings**: No unit tests for the settings form (name/slug validation, delete confirmation).
- **Auth forms**: No unit tests for form validation (email format, password requirements).
- **Sidebar context**: No unit test for keyboard shortcut (⌘+\) registration and state management.
- **OAuth**: GitHub and Google OAuth buttons are rendered but disabled ("coming soon"). Not a gap — intentionally deferred per architecture decision.
- **Realtime**: Not implemented. Deferred to post-MVP per architecture decision.

## History

| Date | Change |
|---|---|
| 2026-04-14 | Initial quality tracking created |
| 2026-04-14 | First real assessment — graded Infrastructure B, API routes C, UI components C |
| 2026-04-16 | Full reassessment after MVP completion (issues #23–#105). All 10 MVP features implemented. 11 test files (58 tests), 8 E2E specs. Lint, typecheck, all tests passing. No open bugs. |
