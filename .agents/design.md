# Design Spec

This is the source of truth for all visual and interaction decisions in Memo.
Read this before implementing or reviewing any UI.

**Storybook is the visual source of truth.** Every UI component has a co-located
`*.stories.tsx` file that renders it in isolation with all variants. Run
`pnpm storybook` to browse the component library. Design token swatches, typography
scale, and spacing scale are documented as stories under "Design System/Tokens".
Visual regression baselines in `e2e/visual-regression.spec.ts-snapshots/` track
every story — run `pnpm test:visual` to detect unintended visual changes.

---

## Design Philosophy

Memo is a workspace tool. It should feel fast, quiet, and dense — like Notion or Linear,
not like a marketing site. Every pixel should serve the user's task.

Principles (in priority order):
1. **Content density** — show more, chrome less. The user's content is the UI.
2. **Spatial consistency** — identical spacing, alignment, and sizing everywhere.
3. **Restraint** — fewer colors, fewer font sizes, fewer shadows. When in doubt, remove.
4. **Speed perception** — instant transitions, skeleton loaders, optimistic updates.

---

## Color

Light and dark mode. Use oklch values via CSS variables — same hue family as
software-factory.dev (hue 250–255, cool-blue undertones). Light mode palette
derived from Ona's web color scheme (ona.com). No arbitrary hex values.

Theme is controlled by `data-theme="light|dark"` on `<html>`. The `.dark` class
is also applied for shadcn compatibility. User preference (light/dark/system) is
stored in `localStorage("memo-theme")` and applied before first paint via an
inline script in `<head>`.

### Core Tokens

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--background` | `oklch(0.13 0.008 255)` | `oklch(0.985 0.002 255)` | Page background |
| `--foreground` | `oklch(0.87 0.01 255)` | `oklch(0.18 0.01 255)` | Primary text |
| `--muted` | `oklch(0.22 0.012 255)` | `oklch(0.93 0.005 255)` | Secondary surfaces |
| `--muted-foreground` | `oklch(0.63 0.012 255)` | `oklch(0.45 0.015 255)` | Secondary text, placeholders |
| `--border` | `oklch(0.22 0.012 255)` | `oklch(0.88 0.005 255)` | Borders and dividers |
| `--primary` | `oklch(0.74 0.032 248)` | `oklch(0.45 0.04 248)` | Primary buttons, active states |
| `--primary-foreground` | `oklch(0.13 0.008 255)` | `oklch(0.985 0.002 255)` | Text on primary |
| `--accent` | `oklch(0.60 0.06 248)` | `oklch(0.45 0.08 248)` | Links, selected items, focus rings |
| `--destructive` | `oklch(0.65 0.2 25)` | `oklch(0.55 0.2 25)` | Delete actions, error states |

### Overlay Tokens (theme-adaptive)

Replace all hardcoded `white/[0.xx]` and `black/[0.xx]` opacity values with these
semantic tokens. They flip between white-on-dark and black-on-light automatically.

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--overlay-subtle` | `white 2%` | `black 2%` | Very faint row hover |
| `--overlay-hover` | `white 4%` | `black 4%` | Hover states |
| `--overlay-border` | `white 6%` | `black 8%` | Subtle borders, separators |
| `--overlay-active` | `white 8%` | `black 6%` | Selected/active states |
| `--overlay-strong` | `white 12%` | `black 12%` | Stronger borders |
| `--overlay-heavy` | `white 20%` | `black 20%` | Heavy emphasis |
| `--overlay-backdrop` | `black 50%` | `black 50%` | Modal/dialog overlays, avatar hover overlays |
| `--overlay-backdrop-foreground` | `white 90%` | `white 90%` | Text/icons on backdrop overlays |

Tailwind classes: `bg-overlay-hover`, `border-overlay-border`, `bg-overlay-backdrop`, `text-overlay-backdrop-foreground`, etc.

### Label Tokens (theme-adaptive)

Replace all hardcoded `text-white/30`, `text-white/50`, `text-white/70` with these.

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--label-faint` | `white 48%` | `oklch(0.54 0.01 255)` | Section headings, kbd hints |
| `--label-muted` | `white 60%` | `oklch(0.50 0.01 255)` | Hover on faint labels |
| `--label-subtle` | `white 70%` | `dark 70%` | Selected item text |

Tailwind classes: `text-label-faint`, `text-label-muted`, `text-label-subtle`.

### Syntax Highlighting Tokens

Used in the Lexical editor code block theme (`src/components/editor/theme.ts`).

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--code-keyword` | `oklch(0.65 0.12 300)` | `oklch(0.45 0.15 300)` | Keywords, operators (purple) |
| `--code-string` | `oklch(0.70 0.12 150)` | `oklch(0.40 0.12 150)` | Strings, chars, selectors (green) |
| `--code-constant` | `oklch(0.65 0.15 25)` | `oklch(0.50 0.15 25)` | Booleans, numbers, constants (red-orange) |
| `--code-type` | `oklch(0.75 0.08 80)` | `oklch(0.45 0.10 80)` | Class names, type annotations (yellow) |
| `--code-builtin` | `oklch(0.70 0.08 200)` | `oklch(0.40 0.10 200)` | Built-in functions and types (cyan) |

Tokens that already map to existing colors: `text-primary` for functions/properties/attrs,
`text-muted-foreground` for comments/punctuation, `text-destructive` for deleted text.

Rules:
- No color outside this token set without updating this file first.
- Accent color is used sparingly — selected sidebar item, focused input, links. Not decorative.
- Borders are near-invisible: 1px solid `--border` (matches `--muted`, blends with surfaces). No box shadows except for dropdowns and modals.
- Use overlay and label tokens for subtle hierarchy — never hardcode `white/` or `black/` opacity values.

---

## Typography

Default typeface: **JetBrains Mono** (monospace), matching the software-factory.dev landing page. Loaded via `next/font/google` with `--font-jetbrains-mono` CSS variable. Falls back to `"Berkeley Mono", "SFMono-Regular", Menlo, Consolas, monospace`.

### Editor Font Families

The editor supports three font families, selectable via the floating toolbar dropdown:

| Key | Font | CSS Variable / Stack | Usage |
|---|---|---|---|
| `monospace` | JetBrains Mono | `var(--font-jetbrains-mono)` (default, no inline style) | Technical content, code-adjacent prose |
| `sans-serif` | Inter | `var(--font-inter), ui-sans-serif, system-ui, sans-serif` | Notes, general writing |
| `serif` | Georgia | `Georgia, 'Times New Roman', serif` | Long-form prose |

Font family is applied as an inline CSS `font-family` style on Lexical `TextNode` via `$patchStyleText`. Monospace is the default — selecting it removes the inline style. Font choice persists in Lexical JSON serialization. Inter is loaded via `next/font/google`; Georgia is a system font.

| Element | Class | Weight | Color |
|---|---|---|---|
| Page title (in editor) | `text-3xl` | `font-bold` | `foreground` |
| Heading 1 | `text-2xl` | `font-semibold` | `foreground` |
| Heading 2 | `text-xl` | `font-semibold` | `foreground` |
| Heading 3 | `text-lg` | `font-medium` | `foreground` |
| Body text | `text-sm` | `font-normal` | `foreground` |
| UI labels (sidebar, buttons) | `text-sm` | `font-medium` | `foreground` |
| Secondary text (timestamps, metadata) | `text-xs` | `font-normal` | `muted-foreground` |
| Code (inline) | `text-sm font-mono` | `font-normal` | `foreground` on `muted` bg |

Rules:
- Body text is always `text-sm` (14px). Not `text-base`.
- No `text-lg` or larger outside of headings in the editor.
- Line height: use Tailwind defaults. Don't override.
- No uppercase text except section labels (e.g. sidebar group headings), which use `text-xs tracking-widest uppercase text-white/30` — matching the landing page convention.
- Since the entire app uses a monospace font, inline code blocks are distinguished by background (`bg-muted`) rather than font change.

---

## Spacing

Use Tailwind's spacing scale. The base unit is 4px.

| Context | Value | Class |
|---|---|---|
| Inline element gap (icon + label) | 8px | `gap-2` |
| Between form fields | 12px | `gap-3` or `space-y-3` |
| Section padding (cards, panels) | 16px | `p-4` |
| Page-level padding | 24px | `p-6` |
| Between major sections | 32px | `gap-8` or `space-y-8` |

Rules:
- Sidebar width: 240px (`w-60`), collapsible to 0.
- Editor max-width: 720px (`max-w-3xl`), centered.
- Never use arbitrary spacing values (`p-[13px]`). Use the scale.
- Consistent padding: if a container uses `p-4`, all similar containers use `p-4`.

---

## Corners

Sharp corners by default. Use `rounded-none` or omit border-radius entirely.

Exceptions (use `rounded-sm` only):
- Dropdown menus and popovers (floating elements need a slight radius to feel intentional).
- Toast notifications.
- Code blocks within the editor.

Everything else — buttons, inputs, cards, sidebar items, dialogs, sheets — uses sharp corners. This matches the industrial aesthetic of the landing page.

Override shadcn defaults: set `--radius: 0` in the theme, then apply `rounded-sm` explicitly on the exceptions listed above.

---

## Layout

### App Shell

```
┌──────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content Area        │
│                  │                            │
│  [Workspace]     │  [Breadcrumb]              │
│  [Search]        │                            │
│  [Page Tree]     │  [Page Title]              │
│                  │  [Editor Content]          │
│                  │                            │
│  [Settings]      │                            │
│  [User Menu]     │                            │
└──────────────────────────────────────────────┘
```

- Sidebar: fixed left, full height, `bg-muted`, `border-r border-white/[0.06]`.
- Main content: fills remaining width, scrolls independently.
- No top navbar. The sidebar handles all navigation.
- Mobile (<768px): sidebar is a Sheet (slides in from left), triggered by hamburger icon.

### Page Tree (Sidebar)

- Indentation: 12px per level (`pl-3` per depth).
- Expand/collapse chevron: 16px, left of page icon.
- Page icon: 16px emoji or default document icon.
- Hover: `bg-white/[0.04]`.
- Selected: `bg-white/[0.08]` with `text-white/70` and `font-medium`.
- Drag handle: visible on hover, left edge.
- "New Page" button: bottom of tree, full width, `text-muted-foreground`.

### Page Icon (Editor)

Above the page title in the editor view. Shows the page's emoji icon or a hover-triggered
add button.

- Position: above the title, left-aligned with the content area.
- Default state (no icon): `SmilePlus` icon (20px, `text-muted-foreground`), visible on hover only.
- With icon: emoji displayed at 40px, clickable to change.
- Click opens the emoji picker floating below the icon.
- Remove button: shown inside the emoji picker when an icon is set.

### Emoji Picker

Floating panel for selecting page icons. Uses `@floating-ui/react` for positioning.

- Background: `bg-background`, border: `border`, shadow: `shadow-lg`.
- Search input at top, auto-focused on open.
- Grid layout: 8 columns, emoji buttons at 32px square.
- Hover: `bg-muted` on emoji buttons.
- Categories: scrollable, filtered by search query.
- Close on Escape or click outside.
- Sharp corners (no border-radius).

### Not-Found Pages

Centered layout with icon + heading + description + CTA button.

- Icon: `FileQuestion` from lucide-react, 48px (`h-12 w-12`), `text-muted-foreground`.
- Heading: `text-lg font-medium`.
- Description: `text-sm text-muted-foreground`, max-width `max-w-sm`.
- CTA: default Button linking to `/`.
- Root not-found: full-screen (`min-h-screen`).
- App not-found: within app shell (`min-h-[60vh]`).

### Error Boundaries

Centered layout matching not-found pages.

- Icon: `AlertCircle` from lucide-react, 48px, `text-muted-foreground`.
- Heading: `text-lg font-medium`, text: "Something went wrong".
- Description: `text-sm text-muted-foreground`, shows `error.message`.
- CTA: "Try again" button calling `reset()`.
- Layout: `min-h-[60vh]`, centered with `flex flex-col items-center justify-center`.

---

## Components

Use shadcn/ui as the base. Override border-radius to `0` globally.

### Buttons

| Variant | When to use |
|---|---|
| `default` | Primary actions (Save, Create) |
| `secondary` | Secondary actions (Cancel, Back) |
| `ghost` | Toolbar actions, sidebar items |
| `destructive` | Delete, remove |
| `outline` | Rarely — form actions that aren't primary |

Rules:
- Size: `sm` in toolbars and dense UI, `default` in forms and dialogs.
- Icons in buttons: 16px (`h-4 w-4`), left of label with `gap-2`.
- Icon-only buttons: use `size="icon"` variant, always include `aria-label`.
- Sharp corners on all buttons. No border-radius.

### Inputs

- Height: `h-9` (default shadcn).
- Border: `border-white/[0.06]`. Sharp corners.
- Focus: `ring-2 ring-ring` (using the `--ring` token).
- Labels: above the input, `text-sm font-medium`, `mb-1.5`.
- Error text: below the input, `text-xs text-destructive`, `mt-1`.

### Dialogs and Sheets

- Dialogs: for confirmations and short forms (< 5 fields).
- Sheets: for longer forms, settings panels, mobile sidebar.
- Overlay: `bg-black/50`.
- Max width: `sm:max-w-md` for dialogs, `sm:max-w-sm` for sheets.
- Sharp corners. No border-radius.

### Dropdowns and Context Menus

- Use shadcn `DropdownMenu` for action menus.
- Use shadcn `ContextMenu` for right-click menus.
- Menu items: `text-sm`, icon (16px) + label, `gap-2`.
- Destructive items: `text-destructive` with destructive icon.
- Keyboard shortcuts: right-aligned, `text-xs text-muted-foreground`.
- Exception: dropdowns use `rounded-sm` (see Corners section).

### Toast Notifications

- Use shadcn `Sonner` (not the old Toast).
- Position: bottom-right.
- Duration: 4 seconds for success, 8 seconds for errors.
- Exception: toasts use `rounded-sm` (see Corners section).
- No toasts for routine actions (save, navigate). Only for:
  - Errors the user needs to know about
  - Async operations completing (page shared, export ready)
  - Destructive actions with undo ("Page deleted" + Undo button)

---

## Editor

The editor is the core of the product. It must feel native.

### Block Types

Each block is a full-width element with consistent vertical spacing.

| Block | Spacing above | Notes |
|---|---|---|
| Paragraph | 2px (`mt-0.5`) | Default block |
| Heading 1 | 24px (`mt-6`) | `text-2xl font-semibold` |
| Heading 2 | 20px (`mt-5`) | `text-xl font-semibold` |
| Heading 3 | 16px (`mt-4`) | `text-lg font-medium` |
| Bullet list | 2px (`mt-0.5`) | Indented 24px per level |
| Numbered list | 2px (`mt-0.5`) | Indented 24px per level |
| To-do list | 2px (`mt-0.5`) | Checkbox + text, indented 24px per level |
| Code block | 12px (`mt-3`) | `bg-muted rounded-sm p-4 font-mono text-sm` |
| Divider | 12px (`mt-3 mb-3`) | `border-t border-white/[0.06]` |
| Callout | 12px (`mt-3`) | `bg-muted p-4`, emoji left, sharp corners |
| Table | 12px (`mt-3`) | Full width, `border-collapse`, `border border-white/[0.06]`, header row `bg-muted font-medium` |
| Image | 12px (`mt-3`) | Max width 100%, centered, optional caption |

### Slash Command Menu

- Triggered by `/` at the start of a line or after a space.
- Appears as a floating menu below the cursor.
- Filterable by typing after `/`.
- Items: icon (20px) + name + description, `text-sm`.
- Max height: 300px, scrollable.
- Keyboard navigation: arrow keys + Enter.
- Uses `rounded-sm` (floating element exception).

### Toolbar

- Floating toolbar appears on text selection.
- Items (left to right): font family dropdown, separator, bold, italic, underline, strikethrough, code, link.
- Font family dropdown: native `<select>`, `appearance-none`, `text-xs`, shows Sans-serif / Serif / Monospace.
- Separator: 1px vertical line (`w-px h-4 bg-overlay-border`) between font dropdown and format buttons.
- Icon-only buttons, 28px square, `gap-0.5`.
- `bg-popover border border-white/[0.06] shadow-md p-1`. Sharp corners.

### Placeholder Text

- Empty page: "Untitled" in the title, `text-muted-foreground`.
- Empty block: "Type '/' for commands" in `text-muted-foreground`.
- Only show placeholder in the focused empty block, not all empty blocks.

---

## Database Views

Database views render structured data within the existing page layout. When a page has
`is_database = true`, the page view renders optional Lexical content above a database grid.

### Layout

```
┌──────────────────────────────────────────────┐
│  [Breadcrumb]                                │
│  [Icon] [Title]                    [Menu]    │
│  [Optional Lexical content above]            │
│                                              │
│  [View Tab 1] [View Tab 2] [+]   [Filter] [Sort] │
│  ┌──────────────────────────────────────────┐│
│  │  Database view (table/board/list/etc.)   ││
│  │                                          ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### View Tabs

- Horizontal tab bar above the database grid, `text-sm`.
- Active tab: `border-b-2 border-accent`, `text-foreground`.
- Inactive tabs: `text-muted-foreground`, hover `text-foreground`.
- `+` button at end of tab bar: opens dropdown to pick view type.
- Tab icons: `Table2` (table), `Columns3` (board), `List` (list), `Calendar` (calendar), `LayoutGrid` (gallery) from lucide-react, 14px.
- Tab bar background: transparent, `border-b border-white/[0.06]`.

### Filter & Sort Bar

- Position: between view tabs and the database grid.
- Background: transparent (no `bg-muted`), `p-2`, sharp corners.
- Active filters: `Badge` components with property name, operator, value. `variant="secondary"`, `text-xs`.
- Remove filter: `X` icon (12px) on each badge, hover `text-destructive`.
- `+ Add filter` button: `ghost` variant, `text-xs text-muted-foreground`.
- Sort indicator in column headers: `ArrowUp` / `ArrowDown` icon (12px), `text-muted-foreground`.

### Table View

- Full-width spreadsheet grid within `max-w-3xl` content area (can overflow with horizontal scroll).
- Column headers: `bg-background` (same as data rows), `text-xs font-medium text-muted-foreground`, `uppercase tracking-widest`, `p-2`, `border-b border-white/[0.06]`. Trailing column uses `minmax(48px, 1fr)` to fill remaining width.
- Column resize: drag handle on right edge of header, `cursor-col-resize`, 2px `bg-accent` indicator while dragging.
- Cells: `p-2 text-sm`, `border-b border-white/[0.06]`. Click to edit inline.
- Row hover: `bg-white/[0.02]`.
- Add row: button at bottom of table, full width, `text-muted-foreground`, `+ New`.
- Add column: `+` button at right end of header row, `text-muted-foreground`.
- Row height options: compact (`h-8`), default (`h-10`), tall (`h-14`).

### Board View

- Horizontal scrollable container of columns.
- Column: `w-72`, `bg-muted/50`, `p-2`, sharp corners.
- Column header: `text-xs font-medium uppercase tracking-widest text-muted-foreground`, `mb-2`.
- Cards: `bg-muted`, `border border-white/[0.06]`, `p-3`, sharp corners, `mb-1.5`.
- Card title: `text-sm font-medium`, truncated to 2 lines.
- Card properties: `text-xs text-muted-foreground`, below title.
- Drag: card at 50% opacity, `shadow-lg`, drop indicator as 2px `bg-accent` line.
- Add card: `+ New` button at bottom of each column, `text-xs text-muted-foreground`.
- Uncategorized column: labeled "No status" (or property name), listed last.

### List View

- Compact vertical list, one row per line.
- Row: `flex items-center gap-2 px-3 py-2 text-sm`, `hover:bg-white/[0.04]`.
- Title: `flex-1 truncate`, left side.
- Visible properties: right side, `text-xs text-muted-foreground`, `gap-3`.
- Click row to open as page.

### Calendar View

- Month grid: 7 columns (Sun–Sat), variable rows.
- Header: month name + year (`text-lg font-medium`), prev/next buttons (`ChevronLeft`/`ChevronRight`, `ghost` variant), today button.
- Day headers: `text-xs uppercase tracking-widest text-muted-foreground`, `text-center`.
- Day cells: `min-h-24`, `border border-white/[0.06]`, `p-1`.
- Today cell: `bg-accent/10`.
- Other month days: `text-muted-foreground/50`.
- Items in cells: `text-xs`, truncated, `bg-muted px-1 py-0.5 mb-0.5`, sharp corners. Max 3 visible, then "+N more" link.
- Click cell: creates new row with that date pre-filled.
- Click item: opens row as page.

### Gallery View

- Responsive card grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`.
- Card sizes: small (`h-40`), medium (`h-52`), large (`h-64`).
- Card: `bg-muted`, `border border-white/[0.06]`, sharp corners, `overflow-hidden`.
- Cover image: fills top portion of card, `object-cover`. No cover: `bg-muted` placeholder with `ImageIcon` (24px, `text-muted-foreground/30`).
- Title: below cover, `p-3 text-sm font-medium`, truncated to 2 lines.
- Click card: opens row as page.

### Property Cells

Inline cell rendering and editing patterns for each property type:

| Type | Renderer | Editor |
|---|---|---|
| Text | Plain text, truncated | Input field, auto-focus |
| Number | Right-aligned, formatted | Input `type="number"` |
| Select | Colored badge | Dropdown with options, create new inline |
| Multi-select | Multiple colored badges, wrapping | Dropdown with checkboxes, create new inline |
| Status | Colored badge (select variant with defaults: Not Started / In Progress / Done) | Same dropdown as Select; new statuses can be added inline |
| Checkbox | Centered checkbox icon | Toggle on click (no separate edit mode) |
| Date | Formatted date string (`MMM D, YYYY`) | Date picker popover |
| URL | Truncated link, `text-accent`, external icon | Input field |
| Email | Truncated email, `text-accent` | Input field |
| Phone | Formatted phone | Input field |
| Person | Avatar circle(s), 20px | Member search dropdown |
| Files | Thumbnail or file icon + name | Upload button + file list |
| Relation | Page link pills (like PageLinkNode) | Database row search dropdown |
| Formula | Computed value (read-only, `text-muted-foreground`) | Not editable |
| Created time | Formatted timestamp (read-only) | Not editable |
| Updated time | Formatted timestamp (read-only) | Not editable |
| Created by | Avatar + name (read-only) | Not editable |

### Select Option Colors

Fixed palette of muted colors for select and multi-select options:

| Name | Background | Text |
|---|---|---|
| Gray | `bg-white/[0.08]` | `text-foreground` |
| Blue | `bg-blue-500/20` | `text-blue-400` |
| Green | `bg-green-500/20` | `text-green-400` |
| Yellow | `bg-yellow-500/20` | `text-yellow-400` |
| Orange | `bg-orange-500/20` | `text-orange-400` |
| Red | `bg-red-500/20` | `text-red-400` |
| Purple | `bg-purple-500/20` | `text-purple-400` |
| Pink | `bg-pink-500/20` | `text-pink-400` |
| Cyan | `bg-cyan-500/20` | `text-cyan-400` |

### Row-as-Page Properties Header

When a database row is opened as a full page, properties display above the Lexical editor:

- Position: between breadcrumb and page title.
- Layout: vertical list of property name + value pairs.
- Property name: `text-xs text-muted-foreground`, `w-32` fixed width, right-aligned.
- Property value: `text-sm`, inline-editable (click to edit).
- Separator: `border-b border-white/[0.06]` between the properties header and the editor content.
- Collapse: if more than 5 properties, show first 5 with "Show N more" toggle.

### Database in Sidebar

- Database pages show `Table2` icon (16px) instead of `FileText` in the page tree.
- "New Database" option in the sidebar create menu (alongside "New Page").
- Database child pages (rows) are NOT shown in the sidebar tree — only the database page itself.

### Inline Database Block

- Spacing above: 12px (`mt-3`), same as table/code/callout blocks.
- Border: `border border-white/[0.06]`, sharp corners.
- Header: database title (linked, `text-sm font-medium text-accent`) + expand icon (`Maximize2`, 14px).
- Compact view: shows the selected view with max 5 rows, no filter/sort bar.
- Click expand: navigates to the database full page.

### Empty Database

- Centered empty state within the database grid area.
- Icon: `Table2` from lucide-react, 48px, `text-muted-foreground`.
- Heading: `text-lg font-medium`, "No rows yet".
- Description: `text-sm text-muted-foreground`, "Add your first row to get started."
- CTA: `Button` default variant, "Add a row".

---

## Interaction Patterns

### Loading States

- **Page navigation**: instant (optimistic). Show skeleton of the page layout while content loads.
- **Data mutations**: optimistic update, revert on error with toast.
- **Initial app load**: full-page skeleton matching the app shell layout.
- **Skeleton style**: `bg-muted animate-pulse`, matching the shape of the content. Sharp corners.

### Empty States

- Centered in the content area.
- Icon (48px, `text-muted-foreground`) + heading (`text-lg font-medium`) + description (`text-sm text-muted-foreground`) + CTA button.
- No illustrations. Keep it simple.

### Keyboard Shortcuts

- Display in tooltips and menu items.
- Format: `⌘` for Mac, `Ctrl` for others. Detect OS.
- Global shortcuts: `⌘+K` (search), `⌘+N` (new page), `⌘+\` (toggle sidebar).

### Drag and Drop

- Drag handle: 6-dot grip icon, `text-muted-foreground`, visible on hover.
- Drop indicator: 2px `bg-accent` line at the drop position.
- Dragging: element at 50% opacity, slight scale (`scale-[1.02]`), `shadow-lg`.

### Transitions

- Sidebar collapse: 200ms ease-out.
- Dropdown/popover open: 150ms ease-out (shadcn default).
- Page transitions: none (instant navigation).
- Hover states: no transition (instant).
- No decorative animations. No bounce, no spring, no parallax.

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| ≥1024px (lg) | Full layout: sidebar + content |
| 768–1023px (md) | Sidebar collapsed by default, toggle to overlay |
| <768px (sm) | Sidebar as Sheet, hamburger in top-left, editor full-width with `px-4` |

- Editor max-width stays `max-w-3xl` on all breakpoints.
- Touch targets: minimum 44px on mobile.
- No horizontal scroll on any breakpoint (except database table view, which uses scroll shadows).

### Database View Responsive Adaptations

| View | Mobile (<768px) | Tablet (768–1023px) | Desktop (≥1024px) |
|---|---|---|---|
| Table | Horizontal scroll with gradient shadow indicators on edges; rows enforce `min-h-[44px]` for touch targets | Same as desktop | Default layout |
| Board | Columns are `w-[85vw]` with `snap-x snap-mandatory` for swipe navigation; dot indicator + "N of M" label below | Default `w-72` columns | Default layout |
| Calendar | Compact day list showing only days with items + today; no 7-column grid | Full month grid | Full month grid |
| Gallery | Already responsive: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` | — | — |
| List | Inherently mobile-friendly (single column) | — | — |

---

## Accessibility

- All interactive elements are keyboard-accessible.
- Focus rings: `ring-2 ring-ring ring-offset-2`.
- Color contrast: minimum 4.5:1 for text, 3:1 for UI elements.
- Images: always have `alt` text.
- Icon-only buttons: always have `aria-label`.
- Page tree: uses `role="tree"` and `role="treeitem"` with `aria-expanded`.
- Editor: uses `role="textbox"` with `aria-multiline="true"`.
- Skip-to-content: `<a>` link in `app-shell.tsx`, visible on focus, jumps to `#main-content`.
- Typeahead menus (slash commands, page-link dropdown, code language selector): `role="listbox"` on container, `role="option"` on items, `aria-activedescendant` for highlight tracking.
- Database table: `role="grid"` on table, `role="row"` on rows, `role="columnheader"` / `role="gridcell"` on cells. Arrow-key navigation between cells.
- Database board/gallery/list: arrow-key navigation with `tabIndex` management. `aria-label` on each card/row describing the item.
- Filter bar: `aria-label` on filter pills, keyboard-navigable dropdowns.
- Live regions: `RowCountAnnouncer` uses `aria-live="polite"` to announce filter/sort result count changes to screen readers.
- Callout blocks: `role="note"` with `aria-label` describing the callout variant.

---

## What NOT to Do

- No gradients on UI surfaces (background gradients on the page shell are acceptable).
- No custom scrollbars.
- No loading spinners — use skeletons.
- No modals for navigation (use routes).
- No color outside the token set.
- No font sizes outside the typography scale.
- No spacing outside the spacing scale.
- No hover animations or transitions on text.
- No "empty" pages with just a button — always provide context.
- No rounded corners except the explicit exceptions in the Corners section.
- No system font stack in the UI shell — use JetBrains Mono. Editor content may use sans-serif (Inter) or serif (Georgia) via the font family selector.
- No visible borders — borders should blend with surfaces (`border-overlay-border` or match `--border` to `--muted`).
- No hardcoded `white/` or `black/` opacity values — use overlay and label tokens instead.
