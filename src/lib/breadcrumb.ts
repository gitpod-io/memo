import type { SidebarPage } from "@/lib/types";

/** Build a map from page ID to its full title chain (e.g. "Parent → Child"). */
export function buildBreadcrumbMap(pages: SidebarPage[]): Map<string, string> {
  const pageMap = new Map<string, SidebarPage>();
  for (const p of pages) {
    pageMap.set(p.id, p);
  }

  const cache = new Map<string, string>();

  function getPath(pageId: string): string {
    if (cache.has(pageId)) return cache.get(pageId)!;

    const page = pageMap.get(pageId);
    if (!page) return "";

    if (!page.parent_id || !pageMap.has(page.parent_id)) {
      const result = page.title || "Untitled";
      cache.set(pageId, result);
      return result;
    }

    const parentPath = getPath(page.parent_id);
    const result = `${parentPath} → ${page.title || "Untitled"}`;
    cache.set(pageId, result);
    return result;
  }

  for (const p of pages) {
    getPath(p.id);
  }

  return cache;
}

/** Get the parent breadcrumb for a page (everything except the page's own title). */
export function getParentBreadcrumb(
  pageId: string,
  breadcrumbMap: Map<string, string>,
): string | null {
  const full = breadcrumbMap.get(pageId);
  if (!full) return null;
  const lastArrow = full.lastIndexOf(" → ");
  if (lastArrow === -1) return null;
  return full.substring(0, lastArrow);
}
