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

Dark mode only. Use oklch values via CSS variables — same hue family as software-factory.dev (hue 250–255, cool-blue undertones). No arbitrary hex values. No light mode.

| Token | Value | Usage |
|---|---|---|
| `--background` | `oklch(0.13 0.008 255)` | Page background |
| `--foreground` | `oklch(0.87 0.01 255)` | Primary text |
| `--muted` | `oklch(0.22 0.012 255)` | Secondary surfaces (sidebar, hover states) |
| `--muted-foreground` | `oklch(0.55 0.012 255)` | Secondary text, placeholders, timestamps |
| `--border` | `oklch(0.22 0.012 255)` | All borders and dividers |
| `--primary` | `oklch(0.74 0.032 248)` | Primary buttons, active states |
| `--primary-foreground` | `oklch(0.13 0.008 255)` | Text on primary |
| `--accent` | `oklch(0.60 0.06 248)` | Links, selected items, focus rings |
| `--destructive` | `oklch(0.55 0.2 25)` | Delete actions, error states |

### Syntax Highlighting Tokens

Used in the Lexical editor code block theme (`src/components/editor/theme.ts`).

| Token | Value | Usage |
|---|---|---|
| `--code-keyword` | `oklch(0.65 0.12 300)` | Keywords, operators (purple) |
| `--code-string` | `oklch(0.70 0.12 150)` | Strings, chars, selectors (green) |
| `--code-constant` | `oklch(0.65 0.15 25)` | Booleans, numbers, constants, tags (red-orange) |
| `--code-type` | `oklch(0.75 0.08 80)` | Class names, type annotations (yellow) |
| `--code-builtin` | `oklch(0.70 0.08 200)` | Built-in functions and types (cyan) |

Tokens that already map to existing colors: `text-primary` for functions/properties/attrs,
`text-muted-foreground` for comments/punctuation, `text-destructive` for deleted text.

Rules:
- No color outside this token set without updating this file first.
- Accent color is used sparingly — selected sidebar item, focused input, links. Not decorative.
- Borders are near-invisible: 1px solid `--border` (matches `--muted`, blends with surfaces). No box shadows except for dropdowns and modals.
- Use `white/` opacity scale for subtle text hierarchy (e.g. `text-white/40`, `text-white/20`) where token classes feel too heavy.

---

## Typography

One typeface: **JetBrains Mono** (monospace), matching the software-factory.dev landing page. Loaded via `next/font/google` with `--font-jetbrains-mono` CSS variable. Falls back to `"Berkeley Mono", "SFMono-Regular", Menlo, Consolas, monospace`.

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
- Items: bold, italic, underline, strikethrough, code, link.
- Icon-only buttons, 28px square, `gap-0.5`.
- `bg-popover border border-white/[0.06] shadow-md p-1`. Sharp corners.

### Placeholder Text

- Empty page: "Untitled" in the title, `text-muted-foreground`.
- Empty block: "Type '/' for commands" in `text-muted-foreground`.
- Only show placeholder in the focused empty block, not all empty blocks.

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
- No horizontal scroll on any breakpoint.

---

## Accessibility

- All interactive elements are keyboard-accessible.
- Focus rings: `ring-2 ring-ring ring-offset-2`.
- Color contrast: minimum 4.5:1 for text, 3:1 for UI elements.
- Images: always have `alt` text.
- Icon-only buttons: always have `aria-label`.
- Page tree: uses `role="tree"` and `role="treeitem"` with `aria-expanded`.
- Editor: uses `role="textbox"` with `aria-multiline="true"`.

---

## What NOT to Do

- No light mode. Dark only.
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
- No system font stack — use JetBrains Mono everywhere.
- No visible borders — borders should blend with surfaces (`border-white/[0.06]` or match `--border` to `--muted`).
