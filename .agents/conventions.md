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

- Unit tests go next to the file they test: `foo.test.ts` alongside `foo.ts`
- Use Vitest: `import { describe, it, expect } from 'vitest'`
- API route tests: test the route handler directly
- Skip tests for components that are just layout/styling with no logic
- Run before pushing: `pnpm lint && pnpm typecheck && pnpm test`

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

### Lexical package versions

All `@lexical/*` packages are pinned to the same version (currently 0.31.0).
Always update them together to avoid version mismatches.

## This file evolves

When you discover a new pattern that should be replicated, or an anti-pattern that
should be avoided, add it here. The Automation Auditor may also propose additions.
