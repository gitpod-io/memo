export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center gap-4">
        {/* "Workspace settings" heading */}
        <div className="h-8 w-56 animate-pulse bg-muted" />
        {/* "Members" link */}
        <div className="h-4 w-16 animate-pulse bg-muted" />
      </div>
      {/* Subtitle */}
      <div className="mt-1 h-4 w-80 animate-pulse bg-muted" />
      {/* Settings form */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Name field */}
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-12 animate-pulse bg-muted" />
          <div className="h-9 w-full animate-pulse bg-muted" />
        </div>
        {/* Slug field */}
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-10 animate-pulse bg-muted" />
          <div className="h-9 w-full animate-pulse bg-muted" />
          <div className="h-3 w-32 animate-pulse bg-muted" />
        </div>
        {/* Save button */}
        <div className="h-9 w-28 animate-pulse bg-muted" />
      </div>
      {/* Danger zone separator + section */}
      <div className="mt-8 h-px w-full bg-muted" />
      <div className="mt-8 flex flex-col gap-3">
        <div className="h-4 w-24 animate-pulse bg-muted" />
        <div className="h-3 w-72 animate-pulse bg-muted" />
        <div className="h-8 w-36 animate-pulse bg-muted" />
      </div>
    </div>
  );
}
