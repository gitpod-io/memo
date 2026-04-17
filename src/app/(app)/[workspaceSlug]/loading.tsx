export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        {/* Workspace name heading */}
        <div className="h-8 w-48 animate-pulse bg-muted" />
        {/* "New Page" button */}
        <div className="h-8 w-24 animate-pulse bg-muted" />
      </div>
      <div className="mt-6 flex flex-col gap-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            {/* Page icon */}
            <div className="h-4 w-4 shrink-0 animate-pulse bg-muted" />
            {/* Page title */}
            <div
              className="h-4 flex-1 animate-pulse bg-muted"
              style={{ maxWidth: `${60 + ((i * 17) % 30)}%` }}
            />
            {/* Timestamp */}
            <div className="h-3 w-12 shrink-0 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
