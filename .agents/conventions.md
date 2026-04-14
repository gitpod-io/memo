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

## This file evolves

When you discover a new pattern that should be replicated, or an anti-pattern that
should be avoided, add it here. The Automation Auditor may also propose additions.
