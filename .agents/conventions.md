# Coding Conventions

## Supabase Server Client (Server Components / Route Handlers)

```typescript
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pages").select("*");

  if (error) {
    throw error;
  }

  return <div>{/* render data */}</div>;
}
```

## Supabase Browser Client (Client Components)

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

## Component File Naming

- One component per file
- Kebab-case filenames: `page-list.tsx`, `workspace-header.tsx`
- Named exports only: `export function PageList() {}`
- No default exports (except Next.js pages/layouts which require them)

## API Route Error Handling

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("pages").select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Database Migrations

```bash
# Create a new migration
supabase migration new add_pages_table

# Edit the generated SQL file in supabase/migrations/
# Always include RLS policies in the same migration
```

## TypeScript

- Strict mode enabled
- No `any` — use `unknown` and narrow
- No `@ts-ignore` — fix the type instead
- No `as` casts unless unavoidable (add a comment explaining why)
- Prefer interfaces for object shapes, types for unions/intersections

## Imports

- Use `@/` path alias for all project imports
- Group imports: external packages → internal modules → types
- No barrel exports (index.ts re-exports)
