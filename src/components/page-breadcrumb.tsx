import Link from "next/link";

export interface BreadcrumbItem {
  id: string;
  title: string;
  href: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  /** Max character length before truncating a segment title */
  maxSegmentLength?: number;
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + "…";
}

export function PageBreadcrumb({
  items,
  maxSegmentLength = 24,
}: PageBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const displayTitle = item.title || "Untitled";
        const truncated = truncateTitle(displayTitle, maxSegmentLength);

        return (
          <span key={item.id} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <span className="shrink-0" aria-hidden="true">
                ›
              </span>
            )}
            {isLast ? (
              <span className="truncate" title={displayTitle}>
                {truncated}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate hover:text-foreground transition-none"
                title={displayTitle}
              >
                {truncated}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
