export default function AppLoading() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Heading row skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse bg-muted" />
        <div className="h-8 w-20 animate-pulse bg-muted" />
      </div>
      {/* Content area skeleton */}
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <div className="h-4 w-4 shrink-0 animate-pulse bg-muted" />
            <div
              className="h-4 flex-1 animate-pulse bg-muted"
              style={{ maxWidth: `${55 + ((i * 13) % 35)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
