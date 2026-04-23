"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { FileText } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";

export interface PageLinkPayload {
  pageId: string;
  key?: NodeKey;
}

export type SerializedPageLinkNode = Spread<
  {
    pageId: string;
  },
  SerializedLexicalNode
>;

function PageLinkComponent({ pageId }: { pageId: string }) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const [title, setTitle] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPage() {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from("pages")
        .select("title, icon")
        .eq("id", pageId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setDeleted(true);
      } else {
        setTitle(data.title || "Untitled");
        setIcon(data.icon ?? null);
      }
      setLoading(false);
    }

    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // Subscribe to realtime changes on the linked page's title/icon
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function subscribe() {
      const supabase = await getClient();
      if (cancelled) return;

      const channel = supabase
        .channel(`page-link-${pageId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pages",
            filter: `id=eq.${pageId}`,
          },
          (payload) => {
            if (cancelled) return;
            if (payload.eventType === "DELETE") {
              setDeleted(true);
            } else if (payload.eventType === "UPDATE") {
              const newData = payload.new as {
                title?: string;
                icon?: string | null;
              };
              if (newData.title !== undefined) {
                setTitle(newData.title || "Untitled");
              }
              if (newData.icon !== undefined) {
                setIcon(newData.icon ?? null);
              }
            }
          },
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    }

    subscribe();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pageId]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground align-baseline">
        <span className="inline-block h-3.5 w-16 animate-pulse bg-overlay-active" />
      </span>
    );
  }

  if (deleted) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground line-through align-baseline">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Deleted page
      </span>
    );
  }

  const href = `/${params.workspaceSlug ?? ""}/${pageId}`;

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
      className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-foreground hover:bg-overlay-active align-baseline cursor-pointer"
      title={title ?? ""}
    >
      {icon ? (
        <span className="shrink-0 text-sm">{icon}</span>
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="underline decoration-muted-foreground/50 underline-offset-2">
        {title}
      </span>
    </a>
  );
}

export class PageLinkNode extends DecoratorNode<JSX.Element> {
  __pageId: string;

  static getType(): string {
    return "page-link";
  }

  static clone(node: PageLinkNode): PageLinkNode {
    return new PageLinkNode(node.__pageId, node.__key);
  }

  static importJSON(serializedNode: SerializedPageLinkNode): PageLinkNode {
    return $createPageLinkNode({ pageId: serializedNode.pageId });
  }

  constructor(pageId: string, key?: NodeKey) {
    super(key);
    this.__pageId = pageId;
  }

  exportJSON(): SerializedPageLinkNode {
    return {
      type: "page-link",
      version: 1,
      pageId: this.__pageId,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "editor-page-link";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-page-id", this.__pageId);
    element.textContent = `[[page:${this.__pageId}]]`;
    return { element };
  }

  getPageId(): string {
    return this.__pageId;
  }

  isInline(): true {
    return true;
  }

  decorate(): JSX.Element {
    return <PageLinkComponent pageId={this.__pageId} />;
  }
}

export function $createPageLinkNode(payload: PageLinkPayload): PageLinkNode {
  return $applyNodeReplacement(
    new PageLinkNode(payload.pageId, payload.key),
  );
}

export function $isPageLinkNode(
  node: LexicalNode | null | undefined,
): node is PageLinkNode {
  return node instanceof PageLinkNode;
}
