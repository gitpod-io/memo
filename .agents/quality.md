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
| Infrastructure | A | Sentry (client + server + edge), proxy with session refresh, health endpoint with tests (6 tests), PWA manifest, global error boundary, Supabase clients (browser + server + proxy). JetBrains Mono font correctly configured. Dark-only oklch theme tokens. Migration validation tests (19 tests). |
| Auth | A | Sign-in, sign-up, invite accept pages. OAuth buttons rendered with "coming soon" tooltip. Auth guard in app layout with redirect. Typography regression test (2 tests). Sign-in unit tests (10 tests): form validation, error handling, redirect logic, loading state. Sign-up unit tests (11 tests): form validation, error handling, redirect logic, loading state. Auth callback route tests (7 tests). Root page tests (4 tests). OAuth buttons unit tests (6 tests). E2E spec covers form rendering, redirect, and sign-in flow (8 tests). |
| Workspaces | A | Workspace home, settings (name/slug/delete), workspace switcher with create dialog. Slug generation utility with unit tests (12 tests). Settings form unit tests (17 tests): validation, save, slug sanitization, delete confirmation flow, error handling. Create workspace dialog unit tests (5 tests). E2E specs cover workspace creation (3 tests), workspace settings (3 tests), and workspace limit enforcement (2 tests). Max 3 workspace limit enforced via DB trigger. |
| Pages | A | Page view with title + editor, page tree with CRUD + drag-and-drop + nest/unnest. Page menu with export/import markdown. Page icon picker with emoji support. Cover images, backlinks, version history, favorites, trash/soft-delete, page duplication. Tree logic extracted to `src/lib/page-tree.ts` (224 lines) with 35 unit tests covering build, reorder, nest, unnest, and drop computation. Page tree keyboard shortcut tests (5 tests). Page icon design spec tests (1 test). Page visit error handling tests (2 tests). Persisted tree expansion tests (9 tests). 8 E2E specs: page CRUD (5), sidebar drag (2), page icon (4), page cover (5), page duplicate (4), favorites (7), trash (7), version history (5) — 39 tests total. |
| Editor | A | Full Lexical editor: slash commands, floating toolbar, floating link editor, drag-and-drop blocks, code highlighting, image upload, callouts, collapsible/toggle blocks, table support. Markdown import/export with shortcuts. Word count and reading time utility (18 tests). 15 unit test files (142 tests): theme mapping (9), markdown utils (8), design spec compliance (11), Node.contains safety (1), Lexical dispatch safety (1), collapsible toggle (8), image plugin (6), markdown shortcuts (12), emoji picker design spec (7), floating image toolbar (21), image node (19), word count (18), auto-link plugin (12), table serialization (6), version save error handling (3). 11 E2E specs (editor-auto-save, editor-callout-collapsible, editor-code-paste, editor-drag, editor-image-upload, editor-link, editor-list-indent, editor-markdown-shortcuts, editor-slash-commands, editor-table, editor-toolbar — 37 tests total). Auto-save with debounce. Sentry error capture on save failures and image uploads. |
| Search | A | Full-text search via PostgreSQL tsvector + tsquery. API route with integration tests (9 tests). Sidebar search component with unit tests (12 tests). Sentry error capture. E2E spec covers search flow (`e2e/search.spec.ts`, 5 tests). |
| Import/Export | A | Markdown export (download .md) and import (parse .md, create page) via page menu. Markdown utils with unit tests (8 tests). E2E spec covers export and import flow (`e2e/import-export.spec.ts`, 2 tests). |
| Members | A | Member list with role badges, role change, remove. Invite form (email + role). Pending invite list with revoke. Invite accept page. Role select dropdown. Settings members page with server-side data fetching. E2E coverage: invite, pending list, revoke, accept, role change, remove, member role restrictions (7 tests). |
| App Shell | A | Collapsible sidebar (desktop: aside, mobile: Sheet), sidebar context with ⌘+\ shortcut, workspace switcher, page tree, user menu with sign-out, focus mode hint. Clean component decomposition. Sidebar context unit tests (19 tests): state management, keyboard shortcut registration, toggle behavior, focus mode. Loading skeleton tests (14 tests): app, workspace, page loading states. Error boundary tests (14 tests): route-error component (6), workspace error (4), page error (4). Focus mode hint design spec tests (3 tests). Workspace home design spec tests (5 tests). E2E spec for sidebar responsive behavior (3 tests). |
| API Routes | A | Health endpoint (DB connectivity check, 6 tests), search endpoint (full-text search, 9 tests), account deletion endpoint (5 tests), trash purge cron endpoint (7 tests), and page versions endpoints (22 tests). All routes have Sentry error capture. All have integration tests with mocked Supabase. Account deletion E2E spec (4 tests). |
| UI Components | A | 13 shadcn/ui components (base-nova style): alert-dialog, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, table, tooltip. Overlay opacity regression test (2 tests). Toast error duration regression test (1 test). Dialog design spec test (3 tests). Design tokens use oklch color space, --radius: 0 for sharp corners. Visual regression E2E spec (1 test). |
| Realtime | - | Deferred to post-MVP per architecture decision. |

## Test Coverage Summary

| Category | Files | Tests |
|---|---|---|
| Unit/Integration (Vitest) | 54 | 473 |
| E2E (Playwright) | 29 | 114 |
| **Total** | **83** | **587** |

### Test files by domain

- **Auth**: `sign-in/page.test.tsx` (10 tests), `sign-up/page.test.tsx` (11 tests), `auth-typography.test.ts` (2 tests), `callback/route.test.ts` (7 tests), `page.test.tsx` (4 tests), `oauth-buttons.test.tsx` (6 tests), `e2e/auth.spec.ts` (8 tests)
- **Workspaces**: `workspace.test.ts` (12 tests), `workspace-settings-form.test.tsx` (17 tests), `create-workspace-dialog.test.tsx` (5 tests), `e2e/workspace.spec.ts` (3 tests), `e2e/workspace-settings.spec.ts` (3 tests), `e2e/workspace-limit.spec.ts` (2 tests)
- **Editor**: `theme.test.ts` (9), `markdown-utils.test.ts` (8), `design-spec-compliance.test.ts` (11), `node-contains-safety.test.ts` (1), `lexical-dispatch-safety.test.ts` (1), `collapsible-toggle.test.ts` (8), `image-plugin.test.ts` (6), `markdown-shortcuts.test.ts` (12), `emoji-picker-design-spec.test.ts` (7), `floating-image-toolbar.test.ts` (21), `image-node.test.ts` (19), `word-count.test.ts` (18), `auto-link-plugin.test.ts` (12), `table-serialization.test.ts` (6), `version-save-error-handling.test.ts` (3), `e2e/editor-auto-save.spec.ts` (2), `e2e/editor-callout-collapsible.spec.ts` (3), `e2e/editor-code-paste.spec.ts` (2), `e2e/editor-drag.spec.ts` (3), `e2e/editor-image-upload.spec.ts` (2), `e2e/editor-link.spec.ts` (3), `e2e/editor-list-indent.spec.ts` (3), `e2e/editor-markdown-shortcuts.spec.ts` (4), `e2e/editor-slash-commands.spec.ts` (6), `e2e/editor-table.spec.ts` (5), `e2e/editor-toolbar.spec.ts` (4)
- **Pages**: `page-tree.test.ts` (35 tests), `page-tree-shortcut.test.tsx` (5 tests), `page-icon-design-spec.test.ts` (1 test), `page-visit.test.ts` (2 tests), `use-persisted-expanded.test.ts` (9 tests), `e2e/page-crud.spec.ts` (5), `e2e/page-icon.spec.ts` (4), `e2e/sidebar-drag.spec.ts` (2), `e2e/page-cover.spec.ts` (5), `e2e/page-duplicate.spec.ts` (4), `e2e/favorites.spec.ts` (7), `e2e/trash.spec.ts` (7), `e2e/version-history.spec.ts` (5)
- **Search**: `search/route.test.ts` (9 tests), `page-search.test.tsx` (12 tests), `e2e/search.spec.ts` (5 tests)
- **Import/Export**: `e2e/import-export.spec.ts` (2 tests)
- **Members**: `invite-form.test.ts` (4 tests), `e2e/members.spec.ts` (7 tests)
- **App Shell**: `sidebar-context.test.tsx` (19 tests), `loading.test.ts` ×3 (14 tests), `route-error.test.ts` (6 tests), `[workspaceSlug]/error.test.ts` (4 tests), `[workspaceSlug]/[pageId]/error.test.ts` (4 tests), `focus-mode-hint-design-spec.test.ts` (3 tests), `workspace-home-design-spec.test.ts` (5 tests), `e2e/sidebar-responsive.spec.ts` (3 tests)
- **API**: `health/route.test.ts` (6 tests), `search/route.test.ts` (9 tests), `account/route.test.ts` (5 tests), `cron/purge-trash/route.test.ts` (7 tests), `pages/[pageId]/versions/route.test.ts` (11 tests), `pages/[pageId]/versions/[versionId]/route.test.ts` (11 tests), `e2e/account-deletion.spec.ts` (4 tests)
- **UI**: `overlay-opacity.test.ts` (2 tests), `toast-error-duration.test.ts` (1 test), `dialog-design-spec.test.ts` (3 tests), `relative-time.test.ts` (7 tests), `e2e/visual-regression.spec.ts` (1 test)
- **Lib**: `sentry.test.ts` (3 tests), `sentry.unit.test.ts` (44 tests), `retry.test.ts` (6 tests)
- **Infrastructure**: `migrations.test.ts` (19 tests)

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
| 2026-04-18 | Test count refresh (#227). Counts drifted as features landed without quality.md updates. Added 11 new Vitest files and 9 new E2E specs. Updated counts for existing files that grew. Test totals: 32 Vitest files (252 tests), 20 E2E specs (74 tests). |
| 2026-04-19 | Test count drift fix (#245). Added missing `invite-form.test.ts` (4 tests) to Members domain. Test totals: 33 Vitest files (256 tests), 20 E2E specs (74 tests). |
| 2026-04-19 | Test count drift fix (#257). Added 3 error boundary test files from #252: `route-error.test.ts` (6), `[workspaceSlug]/error.test.ts` (4), `[workspaceSlug]/[pageId]/error.test.ts` (4). Test totals: 36 Vitest files (270 tests), 20 E2E specs (74 tests). |
| 2026-04-20 | Test count drift fix (#273). Added 3 missing test files: `floating-image-toolbar.test.ts` (20), `image-node.test.ts` (17), `dialog-design-spec.test.ts` (3). Test totals: 39 Vitest files (310 tests), 20 E2E specs (74 tests). |
| 2026-04-20 | Test count drift fix (#286). Updated 4 files that grew: `sign-up/page.test.tsx` (10→11), `floating-image-toolbar.test.ts` (20→21), `image-node.test.ts` (17→19), `sentry.test.ts` (2→3). Added missing `create-workspace-dialog.test.tsx` (5 tests). Test totals: 40 Vitest files (320 tests), 20 E2E specs (74 tests). |
| 2026-04-20 | Test count drift fix (#291). Added missing `account/route.test.ts` (5 tests) from account deletion feature (#288). Updated API Routes domain summary. Test totals: 41 Vitest files (325 tests), 20 E2E specs (74 tests). |
| 2026-04-21 | Test count refresh (#333). Added 5 missing Vitest files: `oauth-buttons.test.tsx` (6), `page-visit.test.ts` (2), `word-count.test.ts` (18), `use-persisted-expanded.test.ts` (9), `migrations.test.ts` (15). Added 3 missing E2E specs: `account-deletion.spec.ts` (4), `workspace-limit.spec.ts` (2), `visual-regression.spec.ts` (1). Updated 3 files with grown counts: `sentry.unit.test.ts` (20→28), `search/route.test.ts` (8→9), `callback/route.test.ts` (3→7). Test totals: 46 Vitest files (388 tests), 23 E2E specs (81 tests). |
| 2026-04-21 | Test count refresh (#405). Added 8 new Vitest files: `auto-link-plugin.test.ts` (12), `table-serialization.test.ts` (6), `version-save-error-handling.test.ts` (3), `focus-mode-hint-design-spec.test.ts` (3), `workspace-home-design-spec.test.ts` (5), `cron/purge-trash/route.test.ts` (7), `pages/[pageId]/versions/route.test.ts` (11), `pages/[pageId]/versions/[versionId]/route.test.ts` (11). Added 6 new E2E specs: `editor-table.spec.ts` (5), `favorites.spec.ts` (7), `page-cover.spec.ts` (5), `page-duplicate.spec.ts` (4), `trash.spec.ts` (7), `version-history.spec.ts` (5). Updated 3 files with grown counts: `sidebar-context.test.tsx` (12→19), `sentry.unit.test.ts` (28→44), `migrations.test.ts` (15→19). Test totals: 54 Vitest files (473 tests), 29 E2E specs (114 tests). |
