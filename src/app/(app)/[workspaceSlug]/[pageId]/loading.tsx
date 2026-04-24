export default function PageLoading() {
  return (
    <div className="mx-auto p-6">
      {/* Breadcrumb skeleton */}
      <div className="mb-2 h-3 w-1/4 animate-pulse bg-muted" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* Title skeleton — matches the h1/input height in PageTitle */}
          <div className="h-9 w-1/3 animate-pulse bg-muted" />
        </div>
        {/* Menu button placeholder */}
        <div className="h-8 w-8 animate-pulse bg-muted" />
      </div>
      <div className="mt-4 space-y-3">
        {/* Content skeleton lines */}
        <div className="h-4 w-full animate-pulse bg-muted" />
        <div className="h-4 w-5/6 animate-pulse bg-muted" />
        <div className="h-4 w-4/6 animate-pulse bg-muted" />
        <div className="h-4 w-full animate-pulse bg-muted" />
        <div className="h-4 w-3/6 animate-pulse bg-muted" />
      </div>
    </div>
  );
}
