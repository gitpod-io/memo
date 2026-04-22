"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RendererProps, EditorProps } from "./index";

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function getUserIds(value: Record<string, unknown>): string[] {
  if (Array.isArray(value.user_ids)) {
    return value.user_ids as string[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Shared avatar types
// ---------------------------------------------------------------------------

interface PersonInfo {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

// ---------------------------------------------------------------------------
// PersonAvatar — shared avatar circle
// ---------------------------------------------------------------------------

interface PersonAvatarProps {
  person: PersonInfo;
  size?: number;
  className?: string;
}

function PersonAvatar({ person, size = 20, className }: PersonAvatarProps) {
  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt={person.display_name}
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-full object-cover",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        // text-xs (12px) overflows a 20px avatar; 0.625rem (10px) fits two initials
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-medium leading-none text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {getInitials(person.display_name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PersonRenderer
// ---------------------------------------------------------------------------

export function PersonRenderer({ value, property }: RendererProps) {
  const userIds = getUserIds(value);

  // Resolve user IDs to display info from property config cache
  const membersMap = useMemo(() => {
    const map = new Map<string, PersonInfo>();
    const members = property.config._members as PersonInfo[] | undefined;
    if (Array.isArray(members)) {
      for (const m of members) {
        map.set(m.id, m);
      }
    }
    return map;
  }, [property.config._members]);

  const people = useMemo(
    () =>
      userIds
        .map((id) => membersMap.get(id))
        .filter((p): p is PersonInfo => p != null),
    [userIds, membersMap],
  );

  if (people.length === 0) return null;

  return (
    <div className="flex items-center">
      {people.map((person, i) => (
        <Tooltip key={person.id}>
          <TooltipTrigger
            className={cn("shrink-0", i > 0 && "-ml-1.5")}
          >
            <PersonAvatar person={person} size={20} />
          </TooltipTrigger>
          <TooltipContent>{person.display_name}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PersonEditor
// ---------------------------------------------------------------------------

export function PersonEditor({
  value,
  property,
  onChange,
  onBlur,
}: EditorProps) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<PersonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(() => new Set(getUserIds(value)), [value]);

  // Fetch workspace members on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      // Extract workspace_id from the property's database page
      const supabase = await getClient();
      const { data: dbPage, error: dbError } = await supabase
        .from("pages")
        .select("workspace_id")
        .eq("id", property.database_id)
        .single();

      if (dbError || !dbPage) {
        if (dbError && !isInsufficientPrivilegeError(dbError)) {
          captureSupabaseError(dbError, "person-editor:db-lookup");
        }
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select(
          "user_id, profiles!members_user_id_fkey(id, display_name, email, avatar_url)",
        )
        .eq("workspace_id", dbPage.workspace_id);

      if (membersError) {
        if (!isInsufficientPrivilegeError(membersError)) {
          captureSupabaseError(membersError, "person-editor:members");
        }
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled && membersData) {
        const resolved: PersonInfo[] = membersData.map((m) => {
          // Supabase join returns the relation as an opaque type
          const profile = m.profiles as unknown as {
            id: string;
            display_name: string;
            email: string;
            avatar_url: string | null;
          };
          return {
            id: m.user_id,
            display_name: profile.display_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
          };
        });
        setMembers(resolved);
        setLoading(false);
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [property.database_id]);

  // Auto-focus search input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        onBlur();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onBlur]);

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      members.filter(
        (m) =>
          m.display_name.toLowerCase().includes(trimmed) ||
          m.email.toLowerCase().includes(trimmed),
      ),
    [members, trimmed],
  );

  const handleToggle = useCallback(
    (userId: string) => {
      const current = getUserIds(value);
      if (selectedIds.has(userId)) {
        onChange({ user_ids: current.filter((id) => id !== userId) });
      } else {
        onChange({ user_ids: [...current, userId] });
      }
    },
    [value, selectedIds, onChange],
  );

  return (
    <div
      ref={containerRef}
      className="w-56 rounded-sm border border-border bg-background shadow-md"
    >
      <div className="p-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onBlur();
              }
            }}
            placeholder="Search members…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto px-1 pb-1">
        {loading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <span className="size-5 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="h-3 w-24 animate-pulse rounded bg-muted" />
                <span className="h-2.5 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        {!loading && filtered.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No members found
          </p>
        )}
        {!loading &&
          filtered.map((member) => {
            const isSelected = selectedIds.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleToggle(member.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-sm",
                  "hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                >
                  {isSelected && <Check className="size-2.5" />}
                </span>
                <PersonAvatar person={member} size={20} />
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-sm">
                    {member.display_name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
