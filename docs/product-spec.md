# Memo — Product Specification

## Vision

A clean, fast collaborative workspace with block-based editing. Think Notion,
but minimal and keyboard-first.

## Target Users

Developers and small teams who want a lightweight workspace for notes,
documentation, and project planning.

## Scope

### In Scope

- Block-based rich text editor (headings, lists, code, quotes, images)
- Pages with nested sub-pages
- Workspaces for organizing content
- Full-text search across pages
- Realtime collaboration (cursors, live edits)
- Dark mode
- Keyboard shortcuts throughout

### Out of Scope

- Database views / tables (Notion-style databases)
- Third-party integrations (Slack, GitHub, etc.)
- AI writing features
- Offline support
- Mobile native apps

## Design Direction

- Minimal UI — content takes center stage
- Keyboard-first interaction model
- Slash commands for block insertion
- Clean typography with generous whitespace
- Smooth transitions, no jarring state changes

## Technical Notes

- **Editor**: Tiptap or BlockNote — block-based, outputs JSON
- **Storage**: Block content stored as JSON in PostgreSQL via Supabase
- **Auth**: Supabase Auth (email/password, OAuth providers)
- **Realtime**: Supabase Realtime for live collaboration
- **Access control**: Row Level Security (RLS) on all tables

## Feature Priority

Ordered by implementation sequence:

1. **Auth** — sign up, sign in, sign out, session management
2. **Pages** — create, read, update, delete, list
3. **Editor** — block-based editing with Tiptap/BlockNote
4. **Slash commands** — insert blocks via `/` menu
5. **Nested pages** — parent/child page hierarchy
6. **Search** — full-text search across page content
7. **Realtime** — live cursors and collaborative editing
8. **Import/Export** — Markdown import and export
9. **Dark mode** — system preference + manual toggle
10. **Members** — workspace invitations and roles
