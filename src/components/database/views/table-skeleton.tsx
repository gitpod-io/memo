import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// TableSkeleton
// ---------------------------------------------------------------------------

interface TableSkeletonProps {
  rowHeight: string;
  columnCount: number;
}

export function TableSkeleton({ rowHeight, columnCount }: TableSkeletonProps) {
  const skeletonRows = 5;
  const cols = Array.from({ length: columnCount }, (_, i) => i);

  return (
    <div className="w-full">
      {/* Header skeleton */}
      <div className="flex border-b border-overlay-border">
        {cols.map((i) => (
          <div key={i} className="flex-1 p-2">
            <div className="h-3 w-16 animate-pulse bg-overlay-border" />
          </div>
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: skeletonRows }, (_, rowIdx) => (
        <div key={rowIdx} className={cn("flex border-b border-overlay-border", rowHeight)}>
          {cols.map((colIdx) => (
            <div key={colIdx} className="flex flex-1 items-center p-2">
              <div
                className="h-3 animate-pulse bg-overlay-border"
                style={{ width: colIdx === 0 ? "60%" : "40%" }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
