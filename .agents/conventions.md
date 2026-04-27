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

### Admin client (service-role, no user session)

For server-only operations without a user session (cron jobs, webhooks), use the
admin client. It uses `SUPABASE_SECRET_KEY` (service role) and must never be
imported from client code.

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient();
const { data, error } = await supabase.rpc("purge_old_trash");
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

Transient network errors are automatically captured at `warning` level instead of
`error` — they are not application bugs and should not trigger error-level alerts.

Browser-style messages: `TypeError: Failed to fetch`, `Failed to fetch`,
`Load failed`, `NetworkError when attempting to fetch resource.`,
`The Internet connection appears to be offline.`, `Network request failed`.
The Supabase client may append the hostname in parentheses, e.g.
`TypeError: Failed to fetch (example.supabase.co)` — use `startsWith` matching,
not exact equality, for the `TypeError: Failed to fetch` pattern.

Node.js native fetch (undici) messages: `fetch failed` or `TypeError: fetch failed`
(top-level), with the real cause wrapped in `error.cause` — look for `ECONNRESET`,
`ENOTFOUND`, `ETIMEDOUT`, `UND_ERR_SOCKET` in the cause message. When Supabase
wraps a Node.js fetch error as a PostgrestError, the message becomes
`"TypeError: fetch failed"` and the cause chain (ECONNRESET etc.) is embedded in
the `details` string rather than `error.cause`. Always check both `error.cause`
and `details` for server-side fetch errors, not just the top-level message.

### Always use `captureSupabaseError` for Supabase errors

Never call `lazyCaptureException` or `Sentry.captureException` directly for errors
originating from Supabase queries or mutations. Always use `captureSupabaseError`
which classifies transient network errors, schema-not-found errors, and RLS
violations at warning level. Direct capture bypasses this classification and floods
Sentry with error-level noise for non-application-bugs.

```typescript
// ✅ Correct — uses captureSupabaseError
captureSupabaseError(error, "editor:save");

// ❌ Wrong — bypasses error classification
lazyCaptureException(error);
```

Reserve `lazyCaptureException` for errors that have no structured classification
(e.g. Lexical editor framework errors, unexpected runtime exceptions).

### Supabase errors may be plain objects, not Error instances

The Supabase PostgREST client (v2.103.0+) returns **plain objects**
`{ message, details, hint, code }` — not `PostgrestError` class instances — when
`fetch` throws a network error in the default (non-`throwOnError`) mode. The
`PostgrestError` class is only instantiated when `shouldThrowOnError` is true.

Do NOT use `instanceof Error` to check for Supabase errors. Use duck-type checks:

```typescript
// ✅ Correct — works for both PostgrestError instances and plain objects
if (error && typeof error === "object" && "code" in error && "details" in error) { ... }

// ❌ Wrong — fails for plain objects from network errors
if (error instanceof Error && "code" in error) { ... }
```

`captureSupabaseError` handles this automatically — it wraps plain objects in a
proper `Error` before sending to Sentry so they get proper stack traces and
grouping. The `isPostgrestError` duck-type check in `src/lib/sentry.ts` also
handles both shapes.

### Always use `captureApiError` for internal API fetch errors

Non-Supabase fetch calls (e.g. `/api/pages/…/versions`) must use `captureApiError`
from `@/lib/sentry`, not `lazyCaptureException`. This classifies transient network
errors (`TypeError: Failed to fetch`, `Load failed`) at warning level.

```typescript
import { captureApiError } from "@/lib/sentry";

// ✅ Correct — classifies transient network errors
captureApiError(error, "versions:fetch");

// ❌ Wrong — bypasses transient network classification
lazyCaptureException(error);
```

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

All catch blocks in API routes must call `Sentry.captureException`, but filter
out expected authorization errors first. Supabase may throw RLS violations as
generic `Error` instances (without PostgrestError shape) in catch blocks, so
always check with `isInsufficientPrivilegeError` before reporting to Sentry:

```typescript
import * as Sentry from "@sentry/nextjs";
import { isInsufficientPrivilegeError } from "@/lib/sentry";

try {
  // ... route logic
} catch (error) {
  if (error instanceof Error && isInsufficientPrivilegeError(error)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  Sentry.captureException(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

### Safe `request.json()` parsing in API routes

`request.json()` throws a `SyntaxError` when the body is empty or malformed JSON.
This is a client error, not an application bug — it must return 400 without reaching
the generic catch block (which would report it to Sentry at error level).

Wrap `request.json()` in its own try-catch before the main route logic:

```typescript
let body: { content: Record<string, unknown> | null };
try {
  body = await request.json() as typeof body;
} catch (_e) {
  // Malformed/empty body is a client error — return 400 without Sentry capture
  return NextResponse.json(
    { error: "Invalid JSON in request body" },
    { status: 400 },
  );
}
```

Use `catch (_e)` (not bare `catch {}`) to satisfy the static analysis convention.

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

### E2E test noise filtering in Sentry

E2E tests (Playwright with HeadlessChrome) can trigger server-side errors that
are not application bugs. Both client-side and server-side Sentry configs must
filter these out:

- **Client-side** — Playwright's auth fixture sets `window.__SENTRY_DISABLED__`
  via `addInitScript`. The `beforeSend` filter checks `isE2ETestSession()`.
- **Server-side** — `sentry.server.config.ts` and `sentry.edge.config.ts` use
  `isE2ETestRequest(event)` which checks the request user-agent for
  `HeadlessChrome/`. This catches errors from API routes and server components
  that the client-side flag cannot reach.

When adding new Sentry config files or `beforeSend` filters, always include
both `isNextjsInternalNoise` and `isE2ETestRequest` checks.

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

## Theme (Light/Dark Mode)

Theme is managed by `src/lib/theme.tsx` which provides `ThemeProvider` and `useTheme`.

- **Storage:** `localStorage("memo-theme")` — values: `"light"`, `"dark"`, `"system"`.
- **Mechanism:** `data-theme="light|dark"` attribute on `<html>`, plus `.dark` class for shadcn.
- **Flash prevention:** Inline `<script>` in `<head>` reads localStorage before React hydrates.
- **System detection:** `prefers-color-scheme` media query listener when preference is `"system"`.
- **Default:** `"dark"` (existing users who haven't set a preference get dark mode).

```typescript
// Reading theme in a client component
import { useTheme } from "@/lib/theme";

function MyComponent() {
  const { preference, resolved, setPreference } = useTheme();
  // preference: "light" | "dark" | "system"
  // resolved: "light" | "dark" (actual applied theme)
}
```

Rules:
- Never hardcode `white/[0.xx]` or `black/[0.xx]` — use overlay/label tokens.
- Use `bg-overlay-hover` instead of `bg-white/[0.04]`.
- Use `border-overlay-border` instead of `border-white/[0.06]`.
- Use `text-label-faint` instead of `text-white/30`.
- The Toaster in `providers.tsx` reads `resolved` theme to pass to Sonner.
- Storybook has a toolbar theme switcher — stories render in both themes.

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
- Every FK referencing `profiles(id)` or `auth.users(id)` must include an `ON DELETE`
  clause (`CASCADE` or `SET NULL`). Omitting it causes the `delete_account` RPC to fail
  with a FK violation when a user deletes their account.
- When adding a new table with a `user_id` or `created_by` FK to `profiles` or
  `auth.users`, also update the `delete_account` RPC
  (`supabase/migrations/20260420150359_delete_account_rpc.sql`) to explicitly handle
  the new table before the profile/auth deletion step. Relying solely on FK cascades
  is fragile — being explicit prevents future breakage.

## Testing

### Testing pyramid — what each test type covers

Each test type has a specific purpose. Do not substitute one for another.

| Test type | Purpose | Examples |
|---|---|---|
| Unit (Vitest) | Pure logic, data transformations, utilities | `database.test.ts` (CRUD with mocked Supabase), `formula.test.ts` (parser/evaluator), `page-tree.test.ts` (tree operations) |
| Component (Vitest + jsdom) | Render components, verify callbacks, check state | Render `PropertyTypePicker`, click an option, verify `onSelect` fires with correct type |
| E2E (Playwright) | User interaction flows in a real browser | Create database, add column via type picker, edit a cell, verify value persists |
| Visual regression (Playwright) | Screenshot Storybook stories, compare baselines | Detect unintended visual changes to existing components |
| Static analysis (Vitest) | Structural convention enforcement only | "No bare catch blocks", "no `@ts-ignore`", migration naming |

**Anti-pattern: source-grep tests for feature behavior.** Do not write Vitest tests
that `readFileSync` source code and assert on string patterns. These verify
implementation details (variable names, import paths), not behavior. Use component
tests or E2E tests instead.

```typescript
// ❌ Wrong — source-grep test for feature behavior
const source = readFileSync(resolve(__dirname, "./database-view-client.tsx"), "utf-8");
expect(source).toMatch(/PROPERTY_TYPE_LABEL\[type\]/);

// ✅ Correct — component test for the same behavior
render(<PropertyTypePicker onSelect={onSelect} />);
await userEvent.click(screen.getByRole("button", { name: /add column/i }));
await userEvent.click(screen.getByText("Date"));
expect(onSelect).toHaveBeenCalledWith("date");
```

Source-grep tests are allowed only for convention enforcement:
```typescript
// ✅ Allowed — convention enforcement
it("no bare catch blocks in source files", () => {
  const files = glob.sync("src/**/*.ts");
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    expect(source).not.toMatch(/catch\s*\{/);
  }
});
```

### E2E tests are mandatory for interactive UI

Any PR that adds or modifies components with user interactions must include E2E
tests in the same PR. This is not optional — the PR Reviewer will block PRs that
add interactive components without E2E coverage.

Interactive components include: buttons that trigger actions, dropdowns, dialogs,
popovers, inline editing, drag-and-drop, keyboard shortcuts.

When a PR changes an existing interaction flow (e.g., replacing a plain button with
a dropdown, replacing `window.prompt` with a styled dialog), it must update **all**
affected E2E tests. Search before committing:
```bash
grep -r '<component-name>\|<selector>\|<old-text>' e2e/
```

### Storybook as visual source of truth

Storybook stories are not just for regression detection — they are the reference
for what components should look like when rendered. Verification must compare
**rendered output in a browser**, not just source code tokens.

**Pre-merge verification (Feature Builder and PR Reviewer):**
1. Build and serve Storybook: `pnpm build-storybook && python3 -m http.server 6099 -d storybook-static &`
2. Open new/modified stories in a browser viewport
3. Visually verify the rendered output matches `.agents/design.md`
4. Fix discrepancies before committing
5. Run `pnpm test:visual` to generate/update baselines
6. Clean up: `kill $(lsof -ti:6099) 2>/dev/null; rm -rf storybook-static`

**Post-merge verification (UI Verifier):**
1. Screenshot Storybook stories for changed components
2. Screenshot the corresponding live site pages
3. Compare Storybook rendering against live site rendering
4. Flag integration-level discrepancies (component works in isolation but breaks in page context)

This catches bugs that static code review misses:
- Layout constraints from parent containers (e.g., `max-w-3xl` on database views)
- CSS cascade issues where page-level styles override component styles
- Missing component wiring (e.g., registry editors not used in table view)
- Portal/overlay interactions that only manifest in the full page context

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

### Menu item click handlers — `onClick`, not `onSelect`

Base UI's `MenuItem` (used by `ContextMenuItem` and `DropdownMenuItem`) uses
`onClick` for item actions. The Radix-style `onSelect` prop does not exist on
Base UI primitives — it is silently ignored if passed, causing menu actions to
never fire.

```typescript
// ✅ Correct — Base UI uses onClick
<ContextMenuItem onClick={() => handleAction("rename")}>
  Rename
</ContextMenuItem>

// ❌ Wrong — onSelect is silently ignored by Base UI
<ContextMenuItem onSelect={() => handleAction("rename")}>
  Rename
</ContextMenuItem>
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

### Deferred deletion with undo

For destructive operations (deleting rows, columns, pages), use a deferred deletion
pattern instead of a confirmation dialog. This reduces friction while preventing
accidental data loss.

```typescript
import { toast } from "sonner";

// 1. Snapshot state for undo
const snapshot = currentItems.find((item) => item.id === targetId);

// 2. Optimistically remove from local state
setItems((prev) => prev.filter((item) => item.id !== targetId));

// 3. Start a deferred timer to persist the deletion
const timer = setTimeout(async () => {
  pendingDeletions.current.delete(targetId);
  const { error } = await deleteFromDatabase(targetId);
  if (error) {
    toast.error("Failed to delete", { duration: 8000 });
    // Reload to restore consistent state
  }
}, 5500); // slightly longer than toast duration

pendingDeletions.current.set(targetId, timer);

// 4. Show toast with undo action
toast("Item deleted", {
  duration: 5000,
  action: {
    label: "Undo",
    onClick: () => {
      clearTimeout(timer);
      pendingDeletions.current.delete(targetId);
      if (snapshot) setItems((prev) => [...prev, snapshot]);
    },
  },
});
```

Rules:
- Use `useRef<Map<string, ReturnType<typeof setTimeout>>>` to track pending deletions.
- Timer duration (5500ms) must exceed toast duration (5000ms) to prevent premature deletion.
- Each deletion gets its own toast — multiple sequential deletions work independently.
- On undo, restore the full snapshot (including related data like row values for columns).
- On timer expiry, persist to the database and handle errors with a reload fallback.

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

## Graceful Degradation for Optional Features

When a feature depends on a database table that may not exist yet (e.g. migration
not applied), the code must degrade silently instead of flooding Sentry with errors.

Pattern: check for `PGRST205` (schema-not-found) before calling `captureSupabaseError`:

```typescript
import { captureSupabaseError, isSchemaNotFoundError } from "@/lib/sentry";

const { data, error } = await supabase.from("optional_table").select("*");
if (error) {
  // Table missing — degrade gracefully, don't report to Sentry
  if (isSchemaNotFoundError(error)) return;
  captureSupabaseError(error, "feature:operation");
  return;
}
```

Additionally, `captureSupabaseError` automatically downgrades `PGRST205` errors to
`warning` level as a safety net, but callers should still skip the call entirely for
read operations on optional tables to avoid unnecessary noise.

## Empty Result from `.single()` (PostgREST PGRST116)

When a `.single()` call returns 0 rows, PostgREST returns PGRST116 ("Cannot coerce
the result to a single JSON object"). This happens when the target row was deleted
between the user action and the lookup — a race condition during concurrent deletion
or E2E test teardown. The caller already handles the null result gracefully (returns
`{ data: null, error }`), so this is not an application bug.

`captureSupabaseError` automatically downgrades PGRST116 to `warning` level via
`isEmptyResultError`. No per-call-site changes are needed — all ~12 `.single()` calls
in `database.ts` benefit from the general classifier.

If a caller needs to distinguish "not found" from other errors (e.g. to return 404),
use `isEmptyResultError` before `captureSupabaseError`:

```typescript
import { captureSupabaseError, isEmptyResultError } from "@/lib/sentry";

const { data, error } = await supabase.from("pages").select("*").eq("id", id).single();
if (error) {
  if (isEmptyResultError(error)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  captureSupabaseError(error, "pages:lookup");
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}
```

## Authorization Errors in API Routes (PostgreSQL 42501)

When an RPC uses `RAISE EXCEPTION` to reject callers who lack access (e.g.
non-members calling workspace-scoped functions), PostgreSQL returns error code
`42501` (insufficient_privilege). This is an expected authorization check, not an
application bug — API routes must return 403 and must NOT report to Sentry.

Pattern: check for `42501` before calling `captureSupabaseError`:

```typescript
import { captureSupabaseError, isInsufficientPrivilegeError } from "@/lib/sentry";

const { data, error } = await supabase.rpc("workspace_rpc", { ws_id: workspaceId });
if (error) {
  if (isInsufficientPrivilegeError(error)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  captureSupabaseError(error, "workspace_rpc");
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}
```

Never return 500 for `42501` — it inflates Sentry error counts with non-bugs.

### Outer catch blocks must also check for 42501

Supabase can throw RLS violations as exceptions (e.g. via `.single()` or async
rejection) instead of returning them in `{ data, error }`. The outer `catch`
block in every API route must check for `isInsufficientPrivilegeError` before
falling through to `Sentry.captureException`:

```typescript
} catch (error) {
  if (error instanceof Error && isInsufficientPrivilegeError(error)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  Sentry.captureException(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

This prevents 42501 errors from being reported at error level in Sentry and
ensures the client receives 403 instead of 500.

### Custom RPC RAISE EXCEPTION with errcode 42501

When a PostgreSQL RPC uses `RAISE EXCEPTION '...' USING errcode = '42501'`,
Supabase may surface the error in two ways:

1. **`{ data, error }` path** — the error is a PostgrestError with `code: "42501"`
2. **Thrown exception** — the error is a generic `Error` with a `code` property
   but without `details`/`hint`, so it fails the `isPostgrestError` duck-type check

`isInsufficientPrivilegeError` handles both shapes: it checks `isPostgrestError`
first, then falls back to checking for a `code` property with value `"42501"`,
and finally checks the message for the RLS violation pattern. This ensures
custom RPC messages like "Not a member of this workspace" are correctly
identified as authorization errors in catch blocks.

### Client-side RLS skip pattern

Client-side Supabase operations (e.g. sidebar page-tree inserts) can also hit
RLS violations — typically when a user exceeds workspace limits. The user already
sees a toast error, so reporting to Sentry is pure noise. Skip
`captureSupabaseError` for both `isSchemaNotFoundError` and
`isInsufficientPrivilegeError`:

```typescript
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";

const { data, error } = await supabase.from("table").insert({ ... }).select().single();
if (error) {
  if (!isSchemaNotFoundError(error) && !isInsufficientPrivilegeError(error)) {
    captureSupabaseError(error, "feature:operation");
  }
  toast.error("Failed to do thing", { duration: 8000 });
  return;
}
```

This applies to any client-side mutation where the RLS rejection is an expected
authorization boundary (workspace limits, non-member access) and the user is
already notified via toast.

### Foreign key violations on deleted parent rows (PostgreSQL 23503)

When a client inserts a row referencing a parent that was deleted between page
load and the mutation (e.g. creating a page in a workspace that was deleted
during E2E test teardown), PostgreSQL returns error code `23503`
(`foreign_key_violation`). This is an expected race condition, not an
application bug — the user already sees a toast error.

`captureSupabaseError` automatically downgrades `23503` to warning level.
Client-side code that guards before calling `captureSupabaseError` should also
skip `isForeignKeyViolationError` to avoid reporting entirely:

```typescript
import {
  captureSupabaseError,
  isForeignKeyViolationError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";

if (error) {
  if (
    !isSchemaNotFoundError(error) &&
    !isInsufficientPrivilegeError(error) &&
    !isForeignKeyViolationError(error)
  ) {
    captureSupabaseError(error, "feature:operation");
  }
  toast.error("Failed to do thing", { duration: 8000 });
}
```

### Duplicate key violations on concurrent mutations (PostgreSQL 23505)

When a user rapidly triggers the same mutation (e.g. double-clicking "add
property"), two identical inserts can race against a unique constraint before
React state updates. PostgreSQL returns error code `23505`
(`unique_violation`). This is an expected race condition, not an application
bug.

**Prevention:** Use a `useRef` boolean guard to prevent concurrent calls in
event handlers that trigger inserts with auto-generated names:

```typescript
const isAdding = useRef(false);

const handleAdd = useCallback(async () => {
  if (isAdding.current) return;
  isAdding.current = true;
  try {
    // ... insert logic
  } finally {
    isAdding.current = false;
  }
}, [deps]);
```

**Safety net:** `captureSupabaseError` automatically downgrades `23505` to
warning level via `isDuplicateKeyError`. Client-side code that guards before
calling `captureSupabaseError` can also skip `isDuplicateKeyError` to avoid
reporting entirely.

### Supabase auth lock contention errors

The Supabase client uses the Web Lock API to serialize auth token refresh.
When multiple concurrent requests race for the lock (e.g. parallel
`favorites:check` calls on page load), the loser gets an `AbortError: Lock
broken by another request with the 'steal' option.` This is expected behavior,
not a bug.

Two error shapes exist:
1. **PostgrestError-like** — `details` contains the AbortError message. Passes
   through `captureSupabaseError` which downgrades to warning level via
   `isSupabaseAuthLockError`.
2. **Unhandled rejection** — Supabase auth internals throw `Lock "lock:sb-..."
   was released because another request stole it`. Dropped by `beforeSend` in
   `instrumentation-client.ts` via `isSupabaseAuthLockContention`.

For client-side code that checks errors before calling `captureSupabaseError`,
also skip `isSupabaseAuthLockError`:

```typescript
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
  isSupabaseAuthLockError,
} from "@/lib/sentry";

if (error) {
  if (
    !isSchemaNotFoundError(error) &&
    !isInsufficientPrivilegeError(error) &&
    !isSupabaseAuthLockError(error)
  ) {
    captureSupabaseError(error, "feature:operation");
  }
}
```

### Statement timeouts (PostgreSQL 57014)

When a query or RPC exceeds the configured statement timeout, PostgreSQL returns
error code `57014`. This typically happens during cascading deletes or heavy
operations on cold connections. It is a transient infrastructure issue, not an
application bug.

`captureSupabaseError` automatically downgrades `57014` to warning level via
`isStatementTimeoutError`. No caller-side skip is needed — the warning-level
classification is sufficient since statement timeouts are rare and worth tracking.

### Safe response parsing in client-side fetch handlers

When calling internal API routes via `fetch()`, always parse the response body
defensively. The server may return non-JSON responses (e.g. 405 Method Not
Allowed with empty body, 502 Bad Gateway with HTML). Calling `res.json()`
directly throws `SyntaxError` on non-JSON bodies.

```typescript
const res = await fetch("/api/endpoint", { method: "DELETE" });

let body: { ok?: boolean; error?: string };
try {
  body = await res.json();
} catch (_e) {
  body = { error: "Operation failed." };
}

if (!res.ok) {
  setError(body.error ?? "Operation failed.");
  return;
}
```

This prevents `SyntaxError: Unexpected end of JSON input` from reaching the
outer catch block and being reported to Sentry as an application error.

## Usage Event Tracking

Product analytics events are recorded via two modules — `src/lib/track-event-server.ts`
(server) and `src/lib/track-event.ts` (client). They are separate files to avoid
pulling `next/headers` into client bundles.

### Server components and API routes

```typescript
import { trackEvent } from "@/lib/track-event-server";

// Fire-and-forget — use `void` to silence the floating promise lint
void trackEvent("page.viewed", user.id, {
  workspaceId: workspace.id,
  pagePath: `/${workspaceSlug}/${pageId}`,
  metadata: { page_id: page.id },
});
```

`trackEvent` dynamically imports the Supabase server client. Errors are captured
in Sentry via `captureSupabaseError` but never thrown.

### Client components

```typescript
import { trackEventClient } from "@/lib/track-event";

// Pass the already-available Supabase browser client
trackEventClient(supabase, "page.created", userId, {
  workspaceId,
  metadata: { page_id: newPage.id, source: "sidebar" },
});
```

`trackEventClient` is synchronous (returns `void`). It wraps the insert in
`Promise.resolve()` to handle Supabase's `PromiseLike` return type and attaches
`.catch()` for error capture.

### Rules

- One `trackEvent`/`trackEventClient` call per action — no wrapping or middleware.
- Place the call after the action succeeds (after error checks, before navigation).
- Include `workspaceId` when available. Include relevant entity IDs in `metadata`.
- Never `await` the tracking call — it must not block the user action.
- When the Supabase client isn't already available (e.g. `handleExport`), use
  `getClient().then(supabase => trackEventClient(...)).catch(() => {})`.

## Database CRUD Layer

Database operations live in `src/lib/database.ts`. All functions use the browser
Supabase client and return `{ data, error }` tuples (matching the Supabase SDK
convention). Errors are reported via `captureSupabaseError` inside the function —
callers only need to check `error` and show a toast.

```typescript
import { createDatabase, addRow, loadDatabase } from "@/lib/database";

// Create a database (page + default property + default view)
const { data, error } = await createDatabase(workspaceId, userId, "Tasks");
if (error) {
  toast.error("Failed to create database", { duration: 8000 });
  return;
}

// Load all data for a database view
const { data: db, error: loadError } = await loadDatabase(databaseId);
if (db) {
  // db.properties, db.views, db.rows are ready
}
```

Key patterns:
- `createDatabase` is pseudo-atomic: creates page → property → view, cleans up
  the page on partial failure.
- `deleteView` prevents deleting the last view (returns an error).
- `addRow` looks up `workspace_id` from the database page automatically.
- `updateRowValue` uses upsert on the `(row_id, property_id)` unique constraint.
- `loadDatabase` fetches properties, views, and rows in parallel via `Promise.all`,
  then loads row values in a single batch query and groups them client-side.
- Position auto-calculation: `addProperty`, `addView`, and `addRow` query the max
  position and increment. Reorder functions accept an ordered ID array.
- `loadWorkspaceMembers` fetches member profiles for a workspace. The parent
  component (`database-view-client.tsx`) injects the result into `property.config._members`
  for `person` and `created_by` properties so renderers can resolve user IDs.

### Computed property types

`created_time`, `updated_time`, and `created_by` are read-only property types that
derive values from page metadata (`row.page.created_at`, `.updated_at`, `.created_by`)
instead of `row_values`. The pattern:

1. Registry entry has `Editor: null` — signals read-only to view components.
2. `isComputedType(type)` checks if a type is computed.
3. `buildComputedValue(type, page)` creates a synthetic value object from page metadata.
4. View components (e.g., `TableView`) call `buildComputedValue` and pass the result
   to the registry `Renderer` instead of reading from `row.values[prop.id]`.
5. For `created_by`, the renderer reads `property.config._members` (same as `PersonRenderer`)
   to resolve user IDs to display names and avatars.

```typescript
import { isComputedType, buildComputedValue, getPropertyTypeConfig } from "@/components/database/property-types";

// In a view component's row rendering:
const value = isComputedType(prop.type)
  ? buildComputedValue(prop.type, row.page)
  : row.values[prop.id]?.value ?? {};
const config = getPropertyTypeConfig(prop.type);
if (config) {
  <config.Renderer value={value} property={prop} />
}
```

## Event Handler Argument Leaks

Never pass a callback that accepts optional business arguments directly to `onClick`.
The browser forwards the `MouseEvent` as the first argument, which gets misinterpreted
as the optional parameter.

```typescript
// ❌ BAD — MouseEvent leaks as initialValues
<button onClick={onAddRow}>+ New</button>

// ✅ GOOD — arrow function discards the event
<button onClick={() => onAddRow()}>+ New</button>
```

When a callback accepts optional structured data (e.g. `initialValues?: Record<…>`),
the receiving function should also guard against non-plain objects as defense-in-depth:

```typescript
const safeValues =
  initialValues &&
  typeof initialValues === "object" &&
  !Array.isArray(initialValues) &&
  Object.getPrototypeOf(initialValues) === Object.prototype
    ? initialValues
    : undefined;
```

## data-testid Naming Convention

Use `data-testid` attributes on interactive elements that E2E tests need to target.
Prefix with the domain to avoid collisions:

| Domain | Prefix | Example |
|---|---|---|
| Database | `db-` | `db-sort-button`, `db-filter-bar`, `db-row-{id}` |
| Editor | `editor-` | `editor-toolbar`, `editor-slash-menu`, `editor-image` |
| Sidebar | `sidebar-` | `sidebar-tree`, `sidebar-search` |

For parameterized IDs, use kebab-case: `db-sort-rule-{index}`, `editor-slash-item-{name}`.

Do not add `data-testid` to every element — only to elements that E2E tests select
and that lack a stable accessible role/label selector.

## This file evolves

When you discover a new pattern that should be replicated, or an anti-pattern that
should be avoided, add it here. The Automation Auditor may also propose additions.
