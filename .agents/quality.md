# Quality Grades

Tracks code quality per domain. Updated by automations as a side effect of feature and test PRs, and through dedicated staleness issues when grades drift from reality.

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
| Auth | A | Sign-in, sign-up, invite accept pages. OAuth buttons rendered with "coming soon" tooltip. Auth guard in app layout with redirect. Typography regression test (2 tests). Sign-in unit tests (8 tests): form validation, error handling, redirect logic, loading state. Sign-up unit tests (9 tests): form validation, error handling, redirect logic, loading state. E2E spec covers form rendering, redirect, and sign-in flow (5 tests). |
| Workspaces | A | Workspace home, settings (name/slug/delete), workspace switcher with create dialog. Slug generation utility with unit tests (12 tests). Settings form unit tests (17 tests): validation, save, slug sanitization, delete confirmation flow, error handling. E2E spec covers workspace creation and settings (3 tests). Max 3 workspace limit enforced via DB trigger. |
| Pages | A | Page view with title + editor, page tree with CRUD + drag-and-drop + nest/unnest. Page menu with export/import markdown. E2E specs for page CRUD (4 tests) and sidebar drag (2 tests). Tree logic extracted to `src/lib/page-tree.ts` (224 lines) with 35 unit tests covering build, reorder, nest, unnest, and drop computation. Component reduced from 836 to 729 lines. |
| Editor | A | Full Lexical editor: slash commands, floating toolbar, floating link editor, drag-and-drop blocks, code highlighting, image upload, callouts, collapsible/toggle blocks. Markdown import/export. 5 unit test files (26 tests): theme mapping, markdown utils, design spec compliance, Node.contains safety, Lexical dispatch safety. 4 E2E specs (editor-drag, editor-link, editor-slash-commands, editor-toolbar — 14 tests total). Auto-save with debounce. Sentry error capture on save failures and image uploads. |
| Search | A | Full-text search via PostgreSQL tsvector + tsquery. API route with integration tests (8 tests). Sidebar search component with unit tests (5 tests). Sentry error capture. E2E spec covers search flow (`e2e/search.spec.ts`, 5 tests). |
| Import/Export | A | Markdown export (download .md) and import (parse .md, create page) via page menu. Markdown utils with unit tests (8 tests). E2E spec covers export and import flow (`e2e/import-export.spec.ts`, 2 tests). |
| Members | A | Member list with role badges, role change, remove. Invite form (email + role). Pending invite list with revoke. Invite accept page. Role select dropdown. Settings members page with server-side data fetching. E2E coverage: invite, pending list, revoke, accept, role change, remove, member role restrictions (7 tests). |
| App Shell | A | Collapsible sidebar (desktop: aside, mobile: Sheet), sidebar context with ⌘+\ shortcut, workspace switcher, page tree, user menu with sign-out. Clean component decomposition. Sidebar context unit tests (8 tests): state management, keyboard shortcut registration, toggle behavior. |
| API Routes | A | Health endpoint (DB connectivity check, 6 tests) and search endpoint (full-text search, 8 tests). Both routes have Sentry error capture. Both have integration tests with mocked Supabase. |
| UI Components | A | 13 shadcn/ui components (base-nova style): alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, table, tooltip. Overlay opacity regression test (2 tests). Toast error duration regression test (1 test). Design tokens use oklch color space, --radius: 0 for sharp corners. |
| Realtime | - | Deferred to post-MVP per architecture decision. |

## Test Coverage Summary

| Category | Files | Tests |
|---|---|---|
| Unit/Integration (Vitest) | 21 | 174 |
| E2E (Playwright) | 11 | 42 |
| **Total** | **32** | **216** |

### Test files by domain

- **Auth**: `sign-in/page.test.tsx` (8 tests), `sign-up/page.test.tsx` (9 tests), `auth-typography.test.ts` (2 tests), `e2e/auth.spec.ts` (5 tests)
- **Workspaces**: `workspace.test.ts` (12 tests), `workspace-settings-form.test.tsx` (17 tests), `e2e/workspace.spec.ts` (3 tests)
- **Editor**: `theme.test.ts` (9), `markdown-utils.test.ts` (8), `design-spec-compliance.test.ts` (7), `node-contains-safety.test.ts` (1), `lexical-dispatch-safety.test.ts` (1), `e2e/editor-drag.spec.ts` (3), `e2e/editor-link.spec.ts` (3), `e2e/editor-slash-commands.spec.ts` (4), `e2e/editor-toolbar.spec.ts` (4)
- **Pages**: `page-tree.test.ts` (35 tests), `e2e/page-crud.spec.ts` (4), `e2e/sidebar-drag.spec.ts` (2)
- **Search**: `search/route.test.ts` (8 tests), `page-search.test.tsx` (5 tests), `e2e/search.spec.ts` (5 tests)
- **Import/Export**: `e2e/import-export.spec.ts` (2 tests)
- **Members**: `e2e/members.spec.ts` (7 tests)
- **App Shell**: `sidebar-context.test.tsx` (8 tests)
- **API**: `health/route.test.ts` (6 tests), `search/route.test.ts` (8 tests)
- **UI**: `overlay-opacity.test.ts` (2 tests), `toast-error-duration.test.ts` (1 test), `relative-time.test.ts` (7 tests)
- **Lib**: `sentry.test.ts` (2 tests), `sentry.unit.test.ts` (20 tests), `retry.test.ts` (6 tests)

## Known Gaps

- **OAuth**: GitHub and Google OAuth buttons are rendered but disabled ("coming soon"). Not a gap — intentionally deferred per architecture decision.
- **Realtime**: Not implemented. Deferred to post-MVP per architecture decision.

## History

| Date | Change |
|---|---|
| 2026-04-14 | Initial quality tracking created |
| 2026-04-14 | First real assessment — graded Infrastructure B, API routes C, UI components C |
| 2026-04-16 | Full reassessment after MVP completion (issues #23–#105). All 10 MVP features implemented. 11 test files (58 tests), 8 E2E specs. Lint, typecheck, all tests passing. No open bugs. |
| 2026-04-16 | Post-MVP update (#119). Pages upgraded B→A (page-tree extraction + 35 unit tests from #113). Import/Export upgraded B→A (E2E added in #111). Search and Members notes updated with E2E specs from #110/#112 and flaky test bug #118. Test totals: 12 Vitest files (93 tests), 11 E2E specs (42 tests). |
| 2026-04-17 | Full reassessment (#155). Auth B→A (sign-in 8 tests + sign-up 9 tests added). App Shell B→A (sidebar-context 8 tests added). Search B→A (flaky test bug #118 closed). Removed 5 resolved known gaps. Added new test files: page-search (5), relative-time (7), retry (6), sentry.unit (20), lexical-dispatch-safety (1). Test totals: 21 Vitest files (174 tests), 11 E2E specs (42 tests). |
