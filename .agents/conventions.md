# Conventions

Detailed coding patterns for this project. AGENTS.md has the rules — this file has
the examples. Read this before writing any new code.

## Supabase Usage

### Server Components (reading data)

The server client uses `@supabase/ssr` with the Next.js `cookies()` API. It is async
because `cookies()` returns a promise in Next.js 16.

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This can be ignored if the proxy refreshes the session.
          }
        },
      },
    }
  );
}
```

Usage in a server component or route handler:

```typescript
const supabase = await createClient();
const { data, error } = await supabase.from("pages").select("*");
```

### Client Components (mutations, realtime)

The browser client is synchronous — no `await` needed.

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

Usage in a client component:

```typescript
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function PageList() {
  const [pages, setPages] = useState<Page[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("pages").select("*").then(({ data }) => {
      if (data) setPages(data);
    });
  }, [supabase]);

  return <ul>{/* render pages */}</ul>;
}
```

### Proxy (session refresh)

Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts`. The proxy refreshes
the Supabase session on every request (except static assets and health checks).

```typescript
// src/proxy.ts
import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

The `updateSession` function in `src/lib/supabase/proxy.ts` creates a server client
that reads cookies from the request and writes refreshed cookies to the response.
It calls `supabase.auth.getUser()` to trigger the refresh.

## Async State in Effects

When a `useCallback` closes over async state (e.g. a resolved ID), putting that
state in the dependency array causes the callback reference to change whenever the
state resolves. If a `useEffect` depends on that callback, the effect re-runs,
creating a cascade of state transitions that race with each other.

**Pattern:** pass async state as a parameter to a stable callback (empty deps).
The effect that calls the callback includes the async state in its own deps so it
re-runs when the state resolves.

### Discarding stale async callbacks

When an effect starts async work (fetch, timer callback), the effect may re-run
before the async work completes. The stale callback must not update state.

**Use a `cancelled` flag, not a generation counter.** A generation counter
(`if (genRef.current !== gen) return`) has a subtle race: if the effect re-runs
between the fetch start and the `finally` block, the counter check fails and the
status transition is skipped — leaving the UI stuck (issues #118–#192). A boolean
`cancelled` flag set once in cleanup is immune to this race.

```typescript
// ❌ Bad — generation counter race in finally block
const gen = ++genRef.current;
fetch(url, { signal }).finally(() => {
  if (genRef.current === gen) setStatus("done"); // skipped if effect re-ran
});

// ✅ Good — cancelled flag set once in cleanup
let cancelled = false;
fetch(url, { signal })
  .then(res => { if (!cancelled) { /* update state */ } })
  .catch(err => { if (!cancelled) { /* handle error */ } });
// cleanup:
return () => { cancelled = true; controller.abort(); };
```

Also: always add `.catch()` to fire-and-forget promises in effects. An unhandled
rejection silently prevents state transitions, leaving the UI stuck.

## Error Handling

All errors must reach Sentry. `console.error` alone is never sufficient — always
pair with a Sentry capture call. Bare `catch {}` is banned except for documented
exceptions (see allowlist below).

### Supabase mutations

Every Supabase mutation must check the error return and call `captureSupabaseError`:

```typescript
import { captureSupabaseError } from "@/lib/sentry";

const { error } = await supabase.from("pages").update({ title }).eq("id", pageId);
if (error) {
  captureSupabaseError(error, "pages.update");
  // handle the error (toast, return error response, etc.)
}
```

The helper accepts `PostgrestError` (from query results) and generic `Error` (from
catch blocks). It tags the Sentry event with the operation name, error code, and
message so errors are filterable in the Sentry dashboard.

Transient network errors (`TypeError: Failed to fetch`, `Load failed`, etc.) are
automatically captured at `warning` level instead of `error` — they are not
application bugs and should not trigger error-level alerts.

### Retrying transient network errors

Client-side Supabase queries that run on page load (e.g. workspace lookup, page
list fetch) should use `retryOnNetworkError` from `@/lib/retry` to retry on
transient network failures before reporting to Sentry:

```typescript
import { retryOnNetworkError } from "@/lib/retry";

const { data, error } = await retryOnNetworkError(() => {
  const supabase = createClient();
  return supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle();
});
```

This retries up to 2 times with exponential backoff (500ms, 1s). Only transient
network errors are retried — application errors (RLS violations, constraint errors)
are returned immediately. Do **not** wrap user-initiated mutations (create, update,
delete) in retry — those should fail fast and show a toast.

### Disambiguating Supabase joins

When a table has multiple foreign keys to the same target table, PostgREST cannot
infer which relationship to use. The query silently returns `null` data (no error
thrown). Disambiguate by specifying the FK constraint name:

```typescript
// BAD — ambiguous: members has both user_id and invited_by referencing profiles
const { data } = await supabase
  .from("members")
  .select("*, profiles(email, display_name)");
// data will be null with a PGRST201 error

// GOOD — specify the FK constraint
const { data } = await supabase
  .from("members")
  .select("*, profiles!members_user_id_fkey(email, display_name)");
```

Check `supabase/migrations/` for constraint names. The naming convention is
`{table}_{column}_fkey`.

### API route catch blocks

All catch blocks in API routes must call `Sentry.captureException`:

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // ... route logic
} catch (error) {
  Sentry.captureException(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

### Client-side mutations

Client-side mutations must show `toast.error()` on failure in addition to Sentry
capture:

```typescript
import { captureSupabaseError } from "@/lib/sentry";
import { toast } from "sonner";

const { error } = await supabase.from("pages").insert({ ... });
if (error) {
  captureSupabaseError(error, "pages.insert");
  toast.error("Failed to create page", { duration: 8000 });
}
```

### Bare catch allowlist

These files have intentional bare `catch {}` blocks with documented reasons:

- `src/lib/supabase/server.ts` — cookie `setAll` in Server Components (can't set cookies, safe to ignore)
- `src/components/editor/editor.tsx` — URL validation (`new URL()` throws on invalid input)
- `src/app/api/health/route.ts` — intentionally silent, monitored by Performance Monitor

All other catch blocks must capture the error variable and report to Sentry.

## Environment Variable Guards

Route handlers and server utilities that use Supabase must guard against missing
env vars before calling `createClient()`. Without the guard, `createServerClient`
receives `undefined` and throws, which can crash the route or produce misleading
error responses (e.g., health endpoint reporting "down" instead of "not configured").

The proxy already does this — route handlers must follow the same pattern:

```typescript
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
) {
  // Return a graceful response instead of crashing
  return NextResponse.json({ status: "ok", db: { connected: false, reason: "not_configured" } });
}
```

Apply this guard in any route handler that calls `createClient()` and must remain
functional even when Supabase is not yet configured (e.g., health checks, public
status endpoints).

## Component Patterns

### Server Component (default)

Server components are the default. They are async functions with named exports
(except `page.tsx` and `layout.tsx` which use default exports per Next.js convention).

```typescript
// src/app/page.tsx — landing page (server component, no "use client")
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Memo
        </h1>
        {/* ... */}
      </div>
    </main>
  );
}
```

### Client Component (only when needed)

Use `"use client"` only for hooks, event handlers, or browser APIs.

```typescript
// src/app/global-error.tsx — needs useEffect and Sentry browser SDK
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

### When to use which

- Fetching and displaying data → server component
- Forms, buttons, interactive UI → client component
- Layout, navigation structure → server component
- Real-time subscriptions → client component

## File Naming

- Components: `kebab-case.tsx` (e.g., `page-list.tsx`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
- All exports are named exports. No default exports.
- One component per file.
- Exception: Next.js pages (`page.tsx`), layouts (`layout.tsx`), and error boundaries
  (`global-error.tsx`) use default exports as required by the framework.

## API Routes

Route handlers use `NextResponse.json()` with structured error handling:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const start = Date.now();
  let dbStatus = "ok";
  let dbLatency = 0;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    // Supabase is not configured — report as unconfigured rather than down
    return NextResponse.json({
      status: "ok",
      db: { connected: false, latency_ms: 0, reason: "not_configured" },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("_health_check")
      .select("1")
      .limit(1)
      .maybeSingle();
    dbLatency = Date.now() - start;
    // Table may not exist yet — that's fine, connection worked if no network error
    if (error && !error.message.includes("does not exist")) {
      dbStatus = "degraded";
    }
  } catch {
    dbStatus = "down";
    dbLatency = Date.now() - start;
  }

  const status = dbStatus === "down" ? "down" : "ok";

  return NextResponse.json({
    status,
    db: { connected: dbStatus !== "down", latency_ms: dbLatency },
    timestamp: new Date().toISOString(),
  });
}
```

Pattern: wrap in try/catch, return structured JSON with appropriate status codes.

### Guarding Supabase env vars in API routes

API route handlers that use the Supabase client must check that env vars are present
before calling `createClient()`. The non-null assertion (`!`) on `process.env` values
does not throw when the value is `undefined` — it silently passes `undefined` to the
Supabase client, which then throws at request time.

```typescript
// ✅ Correct — guard before using the client
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
}
const supabase = await createClient();

// ❌ Wrong — createClient() uses non-null assertions that don't protect against undefined
const supabase = await createClient(); // throws at request time if env vars are missing
```

The proxy (`src/proxy.ts`) already follows this pattern. All API routes must do the same.

## Database Migrations

```bash
npx supabase migration new <descriptive-name>
# Creates: supabase/migrations/<YYYYMMDDHHmmss>_<name>.sql
# The CLI generates the correct UTC timestamp prefix automatically.
```

```sql
-- supabase/migrations/20260414200000_add_pages_table.sql
create table pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now()
);

-- Always include RLS policies in the same migration
alter table pages enable row level security;

create policy "workspace members can read pages"
  on pages for select
  using (workspace_id in (
    select workspace_id from members where user_id = auth.uid()
  ));
```

Rules:
- Always use `npx supabase migration new` — never create migration files manually.
- One migration per logical change (table + its RLS policies together).
- Auto-applied on merge to main via the deploy-migrations CI workflow.

## Testing

### Vitest (unit / integration / static analysis)

- Unit tests go next to the file they test: `foo.test.ts` alongside `foo.ts`
- Use Vitest: `import { describe, it, expect } from 'vitest'`
- API route tests: test the route handler directly
- Skip tests for components that are just layout/styling with no logic

### Playwright (E2E)

E2E tests live in `e2e/` at the project root. Config: `playwright.config.ts`.

```typescript
// Unauthenticated test — uses base Playwright test
import { test, expect } from "@playwright/test";

test("sign-in page renders", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
```

```typescript
// Authenticated test — uses the auth fixture
import { test, expect } from "./fixtures/auth";

test("editor loads on page", async ({ authenticatedPage: page }) => {
  // authenticatedPage is already logged in
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });
});
```

#### Selector conventions

- Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
- For editor elements: `[contenteditable="true"]`, `[data-lexical-editor]`
- For drag handles: `.memo-draggable-block-menu`
- For floating UI: `[role="toolbar"]`, `[role="option"]`
- Use `.filter({ hasText: ... })` to narrow generic selectors

#### Test structure

- One `describe` block per feature area
- Use `test.beforeEach` for common navigation (e.g., opening a page)
- Use `test.skip(true, "reason")` when preconditions aren't met (no pages, no button)
- Timeouts: 10s for page loads, 3s for UI elements, 2s for state changes

#### Running

- All tests: `pnpm test:e2e`
- Single file: `pnpm test:e2e -- e2e/editor-drag.spec.ts`
- Authenticated tests require `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env vars
- Run before pushing: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`

### Storybook

Storybook uses `@storybook/react-vite` (not `@storybook/nextjs` — incompatible with Next.js 16).
Config lives in `.storybook/`. Stories are co-located with components: `component.stories.tsx`
next to `component.tsx`.

#### Story file pattern

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { ComponentName } from "./component-name";

const meta: Meta<typeof ComponentName> = {
  title: "Category/ComponentName",
  component: ComponentName,
  tags: ["autodocs"],
};

export { meta as default };
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {};

export const WithVariant: Story = {
  args: { variant: "destructive" },
};
```

Key conventions:
- `export { meta as default }` — named export pattern, consistent with project rules.
- Title hierarchy: `UI/Button`, `Components/EmojiPicker`, `Auth/OAuthButtons`,
  `Design System/Tokens`.
- Cover: default state, all variants/sizes, disabled/error states, composition examples.
- For components that depend on Supabase or server context, create visual-only stories
  with mock data passed via args or decorators.

#### Interaction tests

Use `@storybook/test` for play functions that test user interactions:

```typescript
import { expect, userEvent, within } from "@storybook/test";

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open/i });
    await userEvent.click(trigger);
    await expect(canvas.getByRole("dialog")).toBeVisible();
  },
};
```

#### Visual regression testing

Baselines live in `e2e/visual-regression.spec.ts-snapshots/` (committed to repo).
The test in `e2e/visual-regression.spec.ts` screenshots every story at 1280×800.

```bash
# Run visual regression (requires Storybook served on port 6099)
pnpm build-storybook
python3 -m http.server 6099 -d storybook-static &
STORYBOOK_URL=http://localhost:6099 pnpm test:visual

# Regenerate baselines after intentional visual changes
STORYBOOK_URL=http://localhost:6099 pnpm test:visual --update-snapshots

# Clean up
kill $(lsof -ti:6099) 2>/dev/null; rm -rf storybook-static
```

#### Running Storybook

- Dev mode: `pnpm storybook` (port 6006)
- Build: `pnpm build-storybook` (outputs to `storybook-static/`, gitignored)

## PR Workflow

### Issue-first rule

For `feat` or `fix` PRs, create (or find) a GitHub issue before opening the PR.

```bash
# Create the issue with status:in-progress so automations don't pick it up
gh issue create --title "Short description" \
  --body "## Problem\n\n...\n\n## Acceptance Criteria\n\n- [ ] ..." \
  --label "feature,status:in-progress"

# Reference it in the PR description
# First line of PR body: Closes #N
```

### Label safety

- Use `status:in-progress` on issues you are actively working on.
- Use `status:backlog` only for issues intended for automation pickup (Feature Builder, Bug Fixer).
- Never label an issue `status:backlog` if you plan to work on it yourself — the Feature Builder or Bug Fixer may claim it first.
- Chore PRs (metrics, docs, deps) do not require an issue.
- Use `ona-user` label on PRs created via interactive Ona sessions — these skip the issue-reference requirement.

## Development Loop

### How to queue work for automations

Create a GitHub Issue with sufficient detail for the Feature Builder or Bug Fixer
to act on. Every issue entering the backlog must have:

- **Description:** what and why
- **Acceptance Criteria:** testable checkboxes
- **Dependencies:** explicit issue refs or "None"
- **Technical Notes:** relevant files, patterns, edge cases
- **3 labels:** status + priority + type

### When to create an issue vs work directly

- **Create an issue with `status:backlog`** when you want an automation to do the work.
- **Create an issue with `status:in-progress`** when you're doing the work yourself.
- **Use `ona-user` on the PR** when working via an interactive Ona session with no issue.

### The `needs-human` feedback loop

1. Feature Planner adds `needs-human` + questions to an insufficient issue.
2. User responds with the requested information.
3. Needs-Human Requeue automation (every 30 min) detects the response and removes `needs-human`.
4. Feature Planner re-triages on its next manual run.

For the full automation roster and workflow details, see `.ona/skills/development-workflow/SKILL.md`.

## Imports

- Use `@/` path alias for all project imports
- Group imports: external packages → internal modules → types
- No barrel exports (index.ts re-exports)

## TypeScript

- Strict mode enabled
- No `any` — use `unknown` and narrow
- No `@ts-ignore` — fix the type instead
- No `as` casts unless unavoidable (add a comment explaining why)
- Prefer interfaces for object shapes, types for unions/intersections

### DOM event target safety

`MouseEvent.target`, `MouseEvent.relatedTarget`, and `FocusEvent.relatedTarget` are
typed as `EventTarget | null`. They can be non-Node objects (e.g. when the mouse
leaves to a cross-origin iframe or the browser window). Never cast them with
`as Node` or `as HTMLElement` — use `instanceof` guards instead.

```typescript
// ✅ Correct — instanceof guard before DOM API call
const target = event.relatedTarget;
if (target instanceof Node && container.contains(target)) { ... }

// ✅ Correct — instanceof guard before property access
const target = event.target;
if (!(target instanceof HTMLElement)) return;
target.closest(".menu");

// ❌ Wrong — unsafe cast, throws TypeError if target is not a Node
container.contains(event.target as Node)
```

A static analysis test (`node-contains-safety.test.ts`) enforces this convention.

## shadcn/ui (base-nova style)

This project uses shadcn/ui v4 with the `base-nova` style, which uses `@base-ui/react`
primitives instead of Radix. Key differences from older shadcn:

### Tooltip composition

base-ui's `TooltipTrigger` does NOT support `asChild`. Use the `render` prop instead:

```typescript
// ✅ Correct — base-ui render prop
<TooltipTrigger
  render={<Button variant="outline" disabled />}
>
  Button label
</TooltipTrigger>

// ❌ Wrong — asChild does not exist on base-ui primitives
<TooltipTrigger asChild>
  <Button>...</Button>
</TooltipTrigger>
```

### Dialogs triggered from dropdown menus

Never nest a `DialogTrigger` inside a `DropdownMenuItem`. Base UI's `DialogTrigger`
with `render={<>{children}</>}` wraps children in a fragment, which has no DOM node
for the click handler. Instead, use controlled dialog state:

```typescript
// ✅ Correct — controlled dialog opened by menu item click
const [dialogOpen, setDialogOpen] = useState(false);

<DropdownMenu>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setDialogOpen(true)}>
      Open dialog
    </DropdownMenuItem>
  </DropdownMenuContent>
  <MyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
</DropdownMenu>

// ❌ Wrong — DialogTrigger inside DropdownMenuItem never fires
<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
  <DialogTrigger render={<>{children}</>} />
</DropdownMenuItem>
```

### Button primitives

Buttons use `@base-ui/react/button` internally. The `Button` component accepts
`ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`.

## Auth Flow

### Route protection (two layers)

1. **Proxy layer** (`src/lib/supabase/proxy.ts`): optimistic redirect — unauthenticated
   users on non-public routes get redirected to `/sign-in`. Public routes: `/`, `/sign-in`,
   `/sign-up`, `/invite/*`.
2. **Layout layer** (`src/app/(app)/layout.tsx`): authoritative check — server component
   calls `supabase.auth.getUser()` and redirects if no user. This is the security boundary.

### Post-auth redirect

After sign-in or sign-up, the client fetches the user's workspace membership to get
the workspace slug, then redirects to `/{workspaceSlug}`. The query joins `members`
with `workspaces` to get the slug in one call:

```typescript
const { data: membership } = await supabase
  .from("members")
  .select("workspace_id, workspaces(slug)")
  .eq("user_id", user.id)
  .limit(1)
  .maybeSingle();
```

### Sign-up data

Pass `display_name` in `signUp` options so the `handle_new_user` trigger can use it:

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: { data: { display_name: displayName } },
});
```

## Lexical Editor Plugins

Editor plugins live in `src/components/editor/`. Each plugin is a separate file with
a single named export. Plugins are composed inside the `<LexicalComposer>` in `editor.tsx`.

### Plugin pattern

```typescript
"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export function MyPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register listeners, commands, transforms
    return () => { /* cleanup */ };
  }, [editor]);

  return null;
}
```

### Floating UI pattern

Floating elements (toolbar, link editor, slash menu) use `@floating-ui/react` for
positioning and `createPortal` to render into the editor's anchor element:

```typescript
import { createPortal } from "react-dom";
import { computePosition, offset, flip, shift } from "@floating-ui/react";

// Position relative to selection or DOM node
computePosition(virtualEl, floatingEl, {
  placement: "top",
  middleware: [offset(8), flip(), shift({ padding: 8 })],
}).then(({ x, y }) => {
  floatingEl.style.left = `${x}px`;
  floatingEl.style.top = `${y}px`;
});

// Render via portal into the editor's anchor div
return createPortal(<div>...</div>, anchorElem);
```

### Auto-save pattern

Content auto-saves via debounced `OnChangePlugin`. The save flow:
1. `OnChangePlugin` fires on every editor state change (selection changes ignored)
2. Serialize: `editorState.toJSON()` → compare with last saved JSON string
3. If changed, debounce 500ms, then write to `pages.content` via Supabase client
4. Track save status: `"idle" | "saving" | "saved"` — display below editor

### Adding new block types

1. Register the node class in `editor.tsx` → `initialConfig.nodes`
2. Add theme classes in `theme.ts` if the node uses themed CSS classes
3. Add a `SlashCommandOption` entry in `slash-command-plugin.tsx`
4. If the block needs a Lexical plugin (e.g., `ListPlugin`), add it inside `<LexicalComposer>`

### Custom node pattern (ElementNode)

Custom block nodes extend `ElementNode`. Each node file exports the class, a `$create*`
factory, and a `$is*` type guard. Nodes must implement `exportJSON()` and `importJSON()`
for persistence. Use `$applyNodeReplacement` in factory functions.

```typescript
export class MyNode extends ElementNode {
  static getType(): string { return "my-node"; }
  static clone(node: MyNode): MyNode { /* ... */ }
  static importJSON(serialized: SerializedMyNode): MyNode { /* ... */ }
  exportJSON(): SerializedMyNode { /* ... */ }
  createDOM(): HTMLElement { /* ... */ }
  updateDOM(): boolean { return false; }
}

export function $createMyNode(): MyNode {
  return $applyNodeReplacement(new MyNode());
}

export function $isMyNode(node: LexicalNode | null | undefined): node is MyNode {
  return node instanceof MyNode;
}
```

### Custom node pattern (DecoratorNode)

DecoratorNodes render React components via `decorate()`. Used for rich blocks like
images that need interactive UI. The component receives the editor instance and node
key for updates.

### Custom plugin + command pattern

Each custom block type has a paired plugin file that:
1. Defines an `INSERT_*_COMMAND` via `createCommand()`
2. Registers the command handler in a `useEffect`
3. Optionally uses `registerMutationListener` for DOM-level behavior (e.g., emoji rendering)

The slash command menu imports the command and dispatches it on selection.

### Dispatching mutating commands

Always wrap `editor.dispatchCommand()` in `editor.update()` when the command's
listener mutates state (e.g. `TOGGLE_LINK_COMMAND`, `FORMAT_TEXT_COMMAND`).
Calling `dispatchCommand` from a React event handler without `editor.update()`
can execute mutations in a read-only context if an `editorState.read()` is active
on the call stack. See Sentry MEMO-5.

```typescript
// ✅ Correct — writable context guaranteed
const handleSave = () => {
  editor.update(() => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  });
};

// ❌ Wrong — may run in read-only context
const handleSave = () => {
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
};
```

A static analysis test (`lexical-dispatch-safety.test.ts`) enforces this pattern.

### Lexical package versions

All `@lexical/*` packages are pinned to the same version (currently 0.31.0).
Always update them together to avoid version mismatches.

### Markdown conversion

Markdown import/export uses `@lexical/markdown` with a shared transformer list defined
in `src/components/editor/markdown-utils.ts`. The `MARKDOWN_TRANSFORMERS` array must
stay in sync with the editor's registered node types — when adding a new block type,
add its transformer here too.

```typescript
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/markdown-utils";
import { $convertToMarkdownString, $convertFromMarkdownString } from "@lexical/markdown";

// Export: inside editor.getEditorState().read()
const markdown = $convertToMarkdownString(MARKDOWN_TRANSFORMERS);

// Import: inside editor.update() or via parseMarkdownToEditorState() for headless conversion
$convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS, root, true);
```

For headless conversion (no mounted editor), use `parseMarkdownToEditorState(markdown)`
which creates a temporary editor, runs the conversion, and returns `SerializedEditorState`.

### Exposing the editor instance

When components outside `<LexicalComposer>` need access to the editor (e.g., page menu
for markdown export), pass an `editorRef` prop to the `Editor` component. The internal
`EditorRefPlugin` captures the editor instance into the ref.

```typescript
const editorRef = useRef<LexicalEditor | null>(null);
<Editor editorRef={editorRef} ... />
// Later: editorRef.current?.getEditorState().read(() => { ... });
```

### Toast notifications

Use `sonner` for toast notifications. The `<Toaster>` is mounted in the root layout.

```typescript
import { toast } from "sonner";

toast.error("Something went wrong", { duration: 8000 });
```

Per design spec: toasts use `rounded-sm`, position bottom-right. Only show toasts for
errors, async completions, and destructive actions with undo — not for routine actions.

## Supabase RPC (database functions)

When a query requires features not available through the Supabase query builder
(e.g., `ts_rank`, `ts_headline`, complex joins with computed columns), create a
PostgreSQL function and call it via `supabase.rpc()`.

```typescript
// Calling an RPC function from a route handler
const { data, error } = await supabase.rpc("search_pages", {
  query: "search term",
  ws_id: workspaceId,
  result_limit: 20,
});
```

Rules:
- Define the function in a migration with `security definer` and `set search_path = ''`.
- Use `stable` for read-only functions, `volatile` for mutations.
- Keep the function focused — one purpose per function.
- Return a `table(...)` type for multi-row results so the client gets typed arrays.

## Route-Level Error Boundaries

Every route segment under `(app)/` should have an `error.tsx` that delegates to the
shared `RouteError` component. This captures the error in Sentry and shows a retry button.

```typescript
// src/app/(app)/[workspaceSlug]/error.tsx
"use client";

import { RouteError } from "@/components/route-error";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
```

The `RouteError` component (`src/components/route-error.tsx`) handles Sentry reporting
and renders a centered error UI with a retry button. Route-level `error.tsx` files are
thin wrappers — all logic lives in `RouteError`.

## Dynamic Page Titles (generateMetadata)

Route pages that display named entities export `generateMetadata` to set the browser
tab title. The pattern fetches the entity name server-side:

```typescript
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("name")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  return { title: data?.name ? `${data.name} — Memo` : "Memo" };
}
```

Rules:
- Suffix all titles with ` — Memo`.
- Fall back to just `"Memo"` if the entity is not found.
- Use `maybeSingle()` — never throw on missing data in metadata functions.

## Loading Skeletons (loading.tsx)

Each route segment under `(app)/` has a `loading.tsx` that renders a skeleton matching
the shape of the page content. Skeletons use `bg-muted animate-pulse` with sharp corners.

Rules:
- Match the layout of the actual page (heading width, content rows, sidebar shape).
- Use varying widths on skeleton rows to look natural (e.g. `maxWidth: ${55 + ((i * 13) % 35)}%`).
- No rounded corners on skeletons — sharp edges per design spec.
- No loading spinners — skeletons only.

## Not-Found Pages

Custom `not-found.tsx` files provide contextual 404 messages:
- Root `not-found.tsx`: full-screen centered, links to `/`.
- `(app)/not-found.tsx`: within the app shell, mentions workspace/page access.

Pattern: `FileQuestion` icon (48px) + heading + description + "Go home" button.

## This file evolves

When you discover a new pattern that should be replicated, or an anti-pattern that
should be avoided, add it here. The Automation Auditor may also propose additions.
