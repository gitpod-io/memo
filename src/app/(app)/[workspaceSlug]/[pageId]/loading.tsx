export default function PageLoading() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* Title skeleton — matches the h1/input height in PageTitle */}
          <div className="h-9 w-1/3 animate-pulse rounded bg-muted" />
        </div>
        {/* Menu button placeholder */}
        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 space-y-3">
        {/* Editor content skeleton lines */}
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
