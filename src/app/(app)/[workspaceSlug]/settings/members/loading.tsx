export default function MembersLoading() {
  return (
    <div className="mx-auto max-w-xl p-6">
      {/* "Members" heading */}
      <div className="h-8 w-32 animate-pulse bg-muted" />
      {/* Subtitle */}
      <div className="mt-1 h-4 w-64 animate-pulse bg-muted" />
      <div className="mt-6 flex flex-col gap-8">
        {/* Invite form skeleton */}
        <div className="flex flex-col gap-3">
          {/* "Invite" section label */}
          <div className="h-3 w-12 animate-pulse bg-muted" />
          <div className="flex items-end gap-2">
            {/* Email field */}
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-4 w-10 animate-pulse bg-muted" />
              <div className="h-9 w-full animate-pulse bg-muted" />
            </div>
            {/* Role select */}
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-8 animate-pulse bg-muted" />
              <div className="h-9 w-28 animate-pulse bg-muted" />
            </div>
            {/* Invite button */}
            <div className="h-9 w-20 animate-pulse bg-muted" />
          </div>
        </div>
        {/* Separator */}
        <div className="h-px w-full bg-muted" />
        {/* Member list skeleton */}
        <div className="flex flex-col gap-3">
          {/* "Members (N)" section label */}
          <div className="h-3 w-24 animate-pulse bg-muted" />
          {/* Table header */}
          <div className="flex items-center gap-4 border-b border-border px-2 pb-2">
            <div className="h-3 w-10 flex-1 animate-pulse bg-muted" />
            <div className="h-3 w-10 animate-pulse bg-muted" />
          </div>
          {/* Member rows */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-2 py-2">
              <div className="flex flex-1 flex-col gap-1">
                <div
                  className="h-4 animate-pulse bg-muted"
                  style={{ width: `${100 + ((i * 23) % 60)}px` }}
                />
                <div
                  className="h-3 animate-pulse bg-muted"
                  style={{ width: `${140 + ((i * 31) % 50)}px` }}
                />
              </div>
              <div className="h-5 w-14 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
