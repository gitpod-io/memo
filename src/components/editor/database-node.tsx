"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { Maximize2, Table2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import { lazyCaptureException } from "@/lib/capture";
import { VIEW_TYPE_ICON } from "@/components/database/view-tabs";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Payload & serialization types
// ---------------------------------------------------------------------------

export interface DatabaseNodePayload {
  databaseId: string;
  viewId: string | null;
  key?: NodeKey;
}

export type SerializedDatabaseNode = Spread<
  {
    databaseId: string;
    viewId: string | null;
  },
  SerializedLexicalNode
>;

// ---------------------------------------------------------------------------
// Inline database component
// ---------------------------------------------------------------------------

interface InlineDatabaseData {
  title: string;
  icon: string | null;
  properties: DatabaseProperty[];
  views: DatabaseView[];
  rows: DatabaseRow[];
}

function InlineDatabaseComponent({
  databaseId,
  viewId,
}: {
  databaseId: string;
  viewId: string | null;
}) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const [data, setData] = useState<InlineDatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(viewId);

  // Load database data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = await getClient();

      // Fetch the database page info
      const { data: page, error: pageError } = await supabase
        .from("pages")
        .select("id, title, icon, is_database, deleted_at")
        .eq("id", databaseId)
        .maybeSingle();

      if (cancelled) return;

      if (pageError || !page || page.deleted_at || !page.is_database) {
        setDeleted(true);
        setLoading(false);
        return;
      }

      // Load properties, views, and rows in parallel
      const [propertiesResult, viewsResult, rowsResult] = await Promise.all([
        supabase
          .from("database_properties")
          .select("*")
          .eq("database_id", databaseId)
          .order("position"),
        supabase
          .from("database_views")
          .select("*")
          .eq("database_id", databaseId)
          .order("position"),
        supabase
          .from("pages")
          .select(
            "id, title, icon, cover_url, created_at, updated_at, created_by",
          )
          .eq("parent_id", databaseId)
          .is("deleted_at", null)
          .order("position")
          .limit(5),
      ]);

      if (cancelled) return;

      if (propertiesResult.error || viewsResult.error || rowsResult.error) {
        setDeleted(true);
        setLoading(false);
        return;
      }

      const properties = propertiesResult.data as DatabaseProperty[];
      const views = viewsResult.data as DatabaseView[];
      const rowPages = rowsResult.data as Array<{
        id: string;
        title: string;
        icon: string | null;
        cover_url: string | null;
        created_at: string;
        updated_at: string;
        created_by: string;
      }>;

      // Load row values
      const rowIds = rowPages.map((r) => r.id);
      let rows: DatabaseRow[] = rowPages.map((p) => ({ page: p, values: {} }));

      if (rowIds.length > 0) {
        const { data: valuesData } = await supabase
          .from("row_values")
          .select("*")
          .in("row_id", rowIds);

        if (!cancelled && valuesData) {
          const valuesByRow = new Map<
            string,
            Record<string, { id: string; row_id: string; property_id: string; value: Record<string, unknown>; created_at: string; updated_at: string }>
          >();
          for (const val of valuesData) {
            let rowMap = valuesByRow.get(val.row_id);
            if (!rowMap) {
              rowMap = {};
              valuesByRow.set(val.row_id, rowMap);
            }
            rowMap[val.property_id] = val;
          }
          rows = rowPages.map((p) => ({
            page: p,
            values: valuesByRow.get(p.id) ?? {},
          }));
        }
      }

      if (cancelled) return;

      // Set active view: prefer the specified viewId, fall back to first view
      if (!activeViewId || !views.some((v) => v.id === activeViewId)) {
        setActiveViewId(views[0]?.id ?? null);
      }

      setData({
        title: page.title || "Untitled Database",
        icon: page.icon,
        properties,
        views,
        rows,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // activeViewId intentionally excluded — only reload on databaseId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseId]);

  const activeView = useMemo(
    () => data?.views.find((v) => v.id === activeViewId) ?? data?.views[0],
    [data?.views, activeViewId],
  );

  const href = `/${params.workspaceSlug ?? ""}/${databaseId}`;

  const handleNavigate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(href);
    },
    [router, href],
  );

  const handleViewChange = useCallback((newViewId: string) => {
    setActiveViewId(newViewId);
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="mt-3 border border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="h-4 w-32 animate-pulse bg-muted" />
          <div className="h-3.5 w-3.5 animate-pulse bg-muted" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Deleted / not found
  if (deleted || !data) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-white/[0.06] px-3 py-3 text-sm text-muted-foreground">
        <Table2 className="h-4 w-4 shrink-0" />
        Database not found
      </div>
    );
  }

  // Compact table rendering (max 5 rows, no filter/sort bar)
  const visibleProperties = activeView?.config.visible_properties
    ? data.properties.filter((p) =>
        activeView.config.visible_properties!.includes(p.id),
      )
    : data.properties.slice(0, 4);

  return (
    <div className="mt-3 border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={href}
            onClick={handleNavigate}
            className="text-sm font-medium text-accent hover:underline truncate"
          >
            {data.icon && <span className="mr-1">{data.icon}</span>}
            {data.title}
          </a>

          {/* View selector */}
          {data.views.length > 1 && (
            <div className="flex items-center gap-0.5 ml-2">
              {data.views.map((view) => {
                const Icon = VIEW_TYPE_ICON[view.type];
                return (
                  <button
                    key={view.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewChange(view.id);
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 text-xs ${
                      view.id === activeViewId
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={view.name}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={handleNavigate}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open full database"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Compact view — table rows only, no filter/sort */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* Title column */}
              <th className="bg-muted p-2 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground border-b border-white/[0.06]">
                Title
              </th>
              {visibleProperties.map((prop) => (
                <th
                  key={prop.id}
                  className="bg-muted p-2 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground border-b border-white/[0.06]"
                >
                  {prop.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleProperties.length + 1}
                  className="px-2 py-6 text-center text-xs text-muted-foreground"
                >
                  No rows yet
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr
                  key={row.page.id}
                  className="hover:bg-white/[0.02] border-b border-white/[0.06]"
                >
                  <td className="p-2 text-sm truncate max-w-[200px]">
                    {row.page.icon && (
                      <span className="mr-1">{row.page.icon}</span>
                    )}
                    {row.page.title || "Untitled"}
                  </td>
                  {visibleProperties.map((prop) => {
                    const rowValue = row.values[prop.id];
                    const displayValue = rowValue?.value
                      ? formatCellValue(prop.type, rowValue.value)
                      : "";
                    return (
                      <td
                        key={prop.id}
                        className="p-2 text-sm text-muted-foreground truncate max-w-[150px]"
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple cell value formatter for compact inline view
function formatCellValue(
  type: string,
  value: Record<string, unknown>,
): string {
  switch (type) {
    case "text":
    case "url":
    case "email":
    case "phone":
      return typeof value.value === "string" ? value.value : "";
    case "number":
      return typeof value.value === "number" ? String(value.value) : "";
    case "checkbox":
      return value.value === true ? "✓" : "";
    case "date":
      if (typeof value.value === "string") {
        const d = new Date(value.value);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
      }
      return "";
    case "select":
      return typeof value.name === "string" ? value.name : "";
    case "multi_select":
      if (Array.isArray(value.values)) {
        return value.values
          .map((v: unknown) =>
            typeof v === "object" && v !== null && "name" in v
              ? (v as { name: string }).name
              : "",
          )
          .filter(Boolean)
          .join(", ");
      }
      return "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// DatabaseNode — Lexical DecoratorNode
// ---------------------------------------------------------------------------

export class DatabaseNode extends DecoratorNode<JSX.Element> {
  __databaseId: string;
  __viewId: string | null;

  static getType(): string {
    return "database";
  }

  static clone(node: DatabaseNode): DatabaseNode {
    return new DatabaseNode(node.__databaseId, node.__viewId, node.__key);
  }

  static importJSON(serializedNode: SerializedDatabaseNode): DatabaseNode {
    return $createDatabaseNode({
      databaseId: serializedNode.databaseId,
      viewId: serializedNode.viewId,
    });
  }

  constructor(databaseId: string, viewId: string | null, key?: NodeKey) {
    super(key);
    this.__databaseId = databaseId;
    this.__viewId = viewId;
  }

  exportJSON(): SerializedDatabaseNode {
    return {
      type: "database",
      version: 1,
      databaseId: this.__databaseId,
      viewId: this.__viewId,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "editor-database";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-database-id", this.__databaseId);
    element.textContent = `[[database:${this.__databaseId}]]`;
    return { element };
  }

  getDatabaseId(): string {
    return this.__databaseId;
  }

  getViewId(): string | null {
    return this.__viewId;
  }

  setViewId(viewId: string | null): void {
    const writable = this.getWritable();
    writable.__viewId = viewId;
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <InlineDatabaseComponent
        databaseId={this.__databaseId}
        viewId={this.__viewId}
      />
    );
  }
}

export function $createDatabaseNode(
  payload: DatabaseNodePayload,
): DatabaseNode {
  return $applyNodeReplacement(
    new DatabaseNode(payload.databaseId, payload.viewId, payload.key),
  );
}

export function $isDatabaseNode(
  node: LexicalNode | null | undefined,
): node is DatabaseNode {
  return node instanceof DatabaseNode;
}
