# Database Views — Feature Specification

## Problem Statement

Memo currently stores all content as unstructured Lexical JSON inside pages. Users have
no way to work with structured data — tracking tasks, contacts, projects, or any
collection of items with consistent properties. Notion-style databases let users define
custom schemas, enter structured rows, and view the same data through multiple lenses
(table, board, list, calendar, gallery). This is the most-requested missing capability
and the natural next step after the block editor is stable.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database identity | Special page type (`is_database = true`) | Databases appear in the sidebar page tree like regular pages. Reuses existing page infrastructure (RLS, nesting, breadcrumbs, favorites, trash). |
| Inline + full-page | Both | A database can be embedded as a block inside another page (inline) AND opened as its own full page. Inline databases reference a database page via ID. |
| Rows are pages | Yes | Each database row is a child page (`parent_id` → database page). Clicking a row opens the full Lexical editor with properties displayed above the content. Reuses page CRUD, search, versioning, and backlinks. |
| Property storage | `database_properties` table + `row_values` table | Properties (schema) stored per-database. Row values stored per-row-page per-property. Separating schema from values enables type validation, view configuration, and efficient queries. |
| Views | Stored per-database in `database_views` table | Each database can have multiple named views. Each view has a type (table, board, list, calendar, gallery), visible properties, sort rules, and filter rules. |
| Formula engine | Simple expressions | Basic math, string concat, if/else, now(), date math. ~10 functions. No full formula language. |
| Created/Updated/CreatedBy | Auto from page metadata | Read-only properties derived from the row page's `created_at`, `updated_at`, `created_by`. No separate storage needed. |

## Data Model

### Modified tables

```
pages (add column)
  is_database: boolean (default false)
  — When true, this page acts as a database container.
  — Child pages (parent_id = this page) are database rows.
  — Regular page features (icon, cover, content) still work on database pages
    (content appears above the database view, like Notion).
```

### New tables

```
database_properties (schema definition — columns of a database)
  id: uuid (PK)
  database_id: uuid (references pages.id ON DELETE CASCADE)
  name: text (not null)
  type: text (not null, check constraint — see Property Types below)
  config: jsonb (type-specific config: select options, number format, formula expression, relation target, etc.)
  position: integer (ordering of columns)
  created_at: timestamptz
  updated_at: timestamptz

  Indexes:
  - (database_id, position) for ordered column listing
  - UNIQUE(database_id, name) to prevent duplicate column names

  RLS: workspace members can CRUD properties for databases in their workspace.

database_views (saved views on a database)
  id: uuid (PK)
  database_id: uuid (references pages.id ON DELETE CASCADE)
  name: text (not null, default 'Default view')
  type: text (not null, check: 'table' | 'board' | 'list' | 'calendar' | 'gallery')
  config: jsonb (view-specific configuration — see View Config below)
  position: integer (ordering of view tabs)
  created_at: timestamptz
  updated_at: timestamptz

  Indexes:
  - (database_id, position) for ordered view tabs

  RLS: workspace members can CRUD views for databases in their workspace.

row_values (property values for each row)
  id: uuid (PK)
  row_id: uuid (references pages.id ON DELETE CASCADE — the row page)
  property_id: uuid (references database_properties.id ON DELETE CASCADE)
  value: jsonb (the actual value — format depends on property type)
  created_at: timestamptz
  updated_at: timestamptz

  Indexes:
  - UNIQUE(row_id, property_id) — one value per property per row
  - (property_id, value) for filtering/sorting queries (GIN index on value)

  RLS: workspace members can CRUD values for rows in their workspace.
```

### Property Types

| Type | `config` schema | `value` schema |
|---|---|---|
| `text` | `{}` | `{"text": "string"}` |
| `number` | `{"format": "number" \| "currency" \| "percent"}` | `{"number": 42.5}` |
| `select` | `{"options": [{"id": "uuid", "name": "str", "color": "str"}]}` | `{"selected": "option_id"}` |
| `multi_select` | `{"options": [{"id": "uuid", "name": "str", "color": "str"}]}` | `{"selected": ["id1", "id2"]}` |
| `checkbox` | `{}` | `{"checked": true}` |
| `date` | `{}` | `{"date": "2026-04-21", "end_date": "2026-04-25" \| null}` |
| `url` | `{}` | `{"url": "https://..."}` |
| `email` | `{}` | `{"email": "user@example.com"}` |
| `phone` | `{}` | `{"phone": "+1234567890"}` |
| `person` | `{}` | `{"user_ids": ["uuid1", "uuid2"]}` |
| `files` | `{}` | `{"files": [{"name": "str", "url": "str"}]}` |
| `relation` | `{"database_id": "uuid"}` | `{"page_ids": ["uuid1", "uuid2"]}` |
| `formula` | `{"expression": "prop(\"Price\") * prop(\"Quantity\")"}` | Computed at read time, not stored. |
| `created_time` | `{}` | Derived from `pages.created_at`. Not stored in `row_values`. |
| `updated_time` | `{}` | Derived from `pages.updated_at`. Not stored in `row_values`. |
| `created_by` | `{}` | Derived from `pages.created_by`. Not stored in `row_values`. |

### View Config Schema

Each view type stores its configuration in `database_views.config`:

```jsonc
// All views share:
{
  "visible_properties": ["prop_id_1", "prop_id_2"],  // which columns to show
  "sorts": [{"property_id": "uuid", "direction": "asc" | "desc"}],
  "filters": [{"property_id": "uuid", "operator": "equals" | "contains" | "is_empty" | "is_not_empty" | "gt" | "lt", "value": <any>}]
}

// Table-specific:
{
  "column_widths": {"prop_id": 200},  // pixel widths
  "row_height": "compact" | "default" | "tall"
}

// Board-specific:
{
  "group_by": "property_id",          // must be a select property
  "hide_empty_groups": false
}

// List-specific:
{
  // No extra config beyond shared fields
}

// Calendar-specific:
{
  "date_property": "property_id"      // which date property positions items
}

// Gallery-specific:
{
  "card_size": "small" | "medium" | "large",
  "cover_property": "property_id" | null  // files property for card cover, or null for page cover
}
```

### Lexical Integration — DatabaseNode

A new `DatabaseNode` (DecoratorNode) for embedding databases inline in pages:

```
DatabaseNode
  type: "database"
  databaseId: string (references pages.id where is_database = true)
  viewId: string | null (which view to show inline; null = first view)
```

When rendered inline, the database shows a compact version of the selected view.
Clicking the expand icon opens the database as a full page.

## View Types

### Table View
- Spreadsheet-style grid with resizable columns
- Inline cell editing (click to edit, Tab to move between cells)
- Add row button at bottom, add column button at right
- Column header: name, type icon, sort indicator, click to configure
- Row checkbox for bulk actions (delete)

### Board View
- Kanban columns grouped by a select property
- Cards show title + configured visible properties
- Drag cards between columns to update the select value
- Add card button at bottom of each column
- Uncategorized column for rows without a value

### List View
- Compact vertical list, one row per line
- Title on the left, visible properties on the right
- Click row to open as page

### Calendar View
- Month grid with navigation (prev/next month, today button)
- Items positioned by a date property
- Items show title (truncated) + optional icon
- Click date cell to create new row with that date pre-filled
- Click item to open as page

### Gallery View
- Card grid (responsive: 2-4 columns depending on viewport)
- Card shows: cover image (from files property or page cover) + title
- Click card to open as page
- No cover: show a muted placeholder or just the title

## Filter & Sort

### Sort
- Sort by any property, ascending or descending
- Multiple sort rules (primary, secondary, etc.)
- Sort persisted per-view in `database_views.config`

### Filters
- Filter by property value with operators:
  - Text: `contains`, `equals`, `is_empty`, `is_not_empty`
  - Number: `equals`, `gt`, `lt`, `gte`, `lte`, `is_empty`, `is_not_empty`
  - Select: `equals`, `is_empty`, `is_not_empty`
  - Multi-select: `contains`, `is_empty`, `is_not_empty`
  - Checkbox: `equals` (true/false)
  - Date: `equals`, `before`, `after`, `is_empty`, `is_not_empty`
  - Person: `contains`, `is_empty`, `is_not_empty`
- Filters are AND-combined (no OR groups in this iteration)
- Filter UI: toolbar above the view with active filter pills
- Filters persisted per-view in `database_views.config`

## URL Structure

```
/[workspaceSlug]/[pageId]                    → database full-page view (when page.is_database = true)
/[workspaceSlug]/[pageId]?view=[viewId]      → specific view of a database
/[workspaceSlug]/[pageId]/[rowPageId]        → row opened as page (existing page route)
```

No new route files needed — the existing `[pageId]/page.tsx` detects `is_database` and
renders the database view instead of (or above) the editor.

## UI Design

Follows the existing design spec (`.agents/design.md`):

- Dark mode only, sharp corners, JetBrains Mono
- View tabs: horizontal tab bar above the database, `text-sm`, active tab has `border-b-2 border-accent`
- New view button: `+` icon at end of tab bar, dropdown to pick view type
- Property config: click column header → dropdown with rename, type change, delete, sort, filter
- Cell editing: click to focus, inline editing, auto-save on blur
- Board cards: `bg-muted`, `border border-white/[0.06]`, `p-3`, sharp corners
- Calendar cells: `border border-white/[0.06]`, today highlighted with `bg-accent/10`
- Gallery cards: `bg-muted`, cover image fills top half, title below, sharp corners
- Filter bar: `bg-muted p-2`, filter pills as `Badge` components, `+ Add filter` button
- Sort indicator: small arrow icon in column header
- Empty database: centered empty state with "Add a row" CTA

## Phased Delivery

### Phase 1: Database Foundation (`priority:1`)
The schema, core CRUD, and table view — enough to create and use a basic database.

**Issues:**
1. **Database schema migration** — Add `is_database` to pages, create `database_properties`, `database_views`, `row_values` tables with RLS policies and indexes. _No dependencies._
2. **Database CRUD operations** — Create database (from sidebar "New Database" button and slash command), delete database, rename. Supabase queries for property CRUD, row CRUD, view CRUD. _Depends on: #1._
3. **Table view component** — Spreadsheet grid with column headers, inline cell editing, add row/column, column resize. Renders database rows with their property values. _Depends on: #2._
4. **Property type renderers & editors** — Cell renderer and inline editor for each property type: text, number, select, multi-select, checkbox, date, URL, email, phone. Reusable across all view types. _Depends on: #2._
5. **Database page detection & routing** — Modify `[pageId]/page.tsx` to detect `is_database` and render database view. Database pages show optional Lexical content above the database grid. View tabs UI (even if only one view exists). _Depends on: #3._
6. **Row-as-page support** — Clicking a row opens it as a full page (`/[workspaceSlug]/[rowPageId]`). Properties displayed above the Lexical editor in a structured header. Back-navigation to parent database. _Depends on: #4, #5._

### Phase 2: Additional Views (`priority:2`)
Board and List views, plus sort and filter.

**Issues:**
7. **Sort & filter engine** — Client-side sort and filter logic that operates on row data. Filter bar UI with property-aware operator selection. Sort UI in column headers and view config. Persisted in `database_views.config`. _Depends on: #3._
8. **Board view component** — Kanban columns grouped by a select property. Drag-and-drop cards between columns. Card rendering with visible properties. _Depends on: #4, #7._
9. **List view component** — Compact row list with title + visible properties. Click to open row as page. _Depends on: #4, #7._
10. **Multi-view management** — Create, rename, delete, reorder views. View type picker. View tabs with active state. Each view stores independent sort/filter/visible properties config. _Depends on: #7._

### Phase 3: Advanced Views & Properties (`priority:2`)
Calendar, Gallery, and the remaining property types.

**Issues:**
11. **Calendar view component** — Month grid with prev/next navigation. Items positioned by date property. Click cell to create row. Click item to open row. _Depends on: #4, #7._
12. **Gallery view component** — Responsive card grid. Cover image from files property or page cover. Title below cover. Click to open row as page. _Depends on: #4, #7._
13. **Person property type** — Renders workspace member avatars. Picker searches workspace members. Stores user IDs. _Depends on: #4._
14. **Files property type** — File upload to Supabase Storage. Renders file thumbnails/links. Reuses existing image upload infrastructure. _Depends on: #4._
15. **Relation property type** — Links rows to rows in another database. Picker searches target database rows. Renders as linked page pills (similar to PageLinkNode). _Depends on: #4._

### Phase 4: Inline Databases & Formulas (`priority:3`)
Embedding databases in pages and computed properties.

**Issues:**
16. **DatabaseNode (inline database block)** — Lexical DecoratorNode that embeds a database view inside a page. Slash command to insert. Compact rendering with expand-to-full-page button. _Depends on: #5, #10._
17. **Formula property type** — Expression parser and evaluator. Supports basic math, string concat, if/else, now(), date math, prop() references. Computed at read time. _Depends on: #4._
18. **Database in sidebar** — Database pages show a distinct icon in the page tree (grid/table icon instead of document icon). "New Database" option in sidebar create menu. _Depends on: #5._

## Issue Dependency Graph

```
#1 Database schema migration
 └─► #2 Database CRUD operations
      ├─► #3 Table view component ──────────────────┐
      │    └─► #5 Database page detection & routing ─┤
      │         └─► #6 Row-as-page support ◄─────────┤
      └─► #4 Property type renderers & editors ──────┘
           │    └─► #13 Person property
           │    └─► #14 Files property
           │    └─► #15 Relation property
           │    └─► #17 Formula property
           │
           ├─► #7 Sort & filter engine ◄── #3
           │    ├─► #8 Board view
           │    ├─► #9 List view
           │    ├─► #10 Multi-view management
           │    │    └─► #16 DatabaseNode (inline)
           │    ├─► #11 Calendar view
           │    └─► #12 Gallery view
           │
           └─► #18 Database in sidebar ◄── #5
```

## Acceptance Criteria

### Database Foundation
- [ ] User can create a database from the sidebar (appears as a page with grid icon)
- [ ] User can define properties (columns) with name and type
- [ ] User can add, edit, and delete rows in table view
- [ ] Inline cell editing works for all basic property types (text, number, select, multi-select, checkbox, date, URL, email, phone)
- [ ] Select/multi-select properties support creating new options inline
- [ ] Database page shows optional rich text content above the database grid
- [ ] Clicking a row opens it as a full page with properties header + Lexical editor
- [ ] Row page shows breadcrumb: workspace → database → row
- [ ] Created time, Updated time, Created by properties auto-derive from page metadata
- [ ] All database data respects workspace RLS policies

### Views
- [ ] User can create multiple views per database (table, board, list, calendar, gallery)
- [ ] View tabs appear above the database, active view highlighted
- [ ] Each view stores independent configuration (visible properties, sort, filter)
- [ ] Table view: resizable columns, column reorder, add row/column
- [ ] Board view: Kanban grouped by select property, drag cards between columns
- [ ] List view: compact rows with title + visible properties
- [ ] Calendar view: month grid, items on date cells, prev/next month navigation
- [ ] Gallery view: card grid with cover image + title

### Filter & Sort
- [ ] User can sort by any property (ascending/descending)
- [ ] User can add multiple sort rules
- [ ] User can filter by property value with type-appropriate operators
- [ ] Active filters shown as pills in filter bar
- [ ] Filters and sorts persist per-view

### Inline Database
- [ ] User can insert a database block via slash command (`/database`)
- [ ] Inline database renders a compact view of the referenced database
- [ ] Expand button opens the database as a full page
- [ ] Inline database respects the selected view's configuration

### Advanced Properties
- [ ] Person property shows member avatars, picker searches workspace members
- [ ] Files property supports upload and renders thumbnails
- [ ] Relation property links to rows in another database, renders as pills
- [ ] Formula property evaluates simple expressions referencing other properties

## Implementation Notes

- **No new Supabase buckets needed** — file uploads for the files property reuse the existing `page-images` bucket.
- **Reuse existing page infrastructure** — rows are pages, so search, favorites, trash, version history, backlinks all work on database rows automatically.
- **Client-side filtering/sorting** — for the initial implementation, load all rows and filter/sort in the browser. Pagination and server-side filtering can be added later if databases grow large.
- **Property type renderers** should be a registry pattern (`Record<PropertyType, { Renderer, Editor }>`) so new types can be added without modifying view components.
- **Board drag-and-drop** — reuse the drag-and-drop patterns from the existing `DraggableBlockPlugin` and page tree.
- **Calendar** — build from scratch with Tailwind grid, no external calendar library.
- **Formula evaluation** — a simple recursive descent parser. No need for a full AST library. Evaluate on the client at render time.
- **Select option colors** — use a fixed palette of 8-10 colors from the design token set (muted variants of accent, destructive, etc.).
