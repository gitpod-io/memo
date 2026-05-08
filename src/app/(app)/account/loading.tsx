export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-xl p-6">
      {/* Heading */}
      <div className="h-8 w-48 animate-pulse bg-muted" />
      {/* Subtitle */}
      <div className="mt-1 h-4 w-72 animate-pulse bg-muted" />
      {/* Avatar section */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-4 w-12 animate-pulse bg-muted" />
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse bg-muted" />
          <div className="flex flex-col gap-1">
            <div className="h-8 w-28 animate-pulse bg-muted" />
            <div className="h-3 w-40 animate-pulse bg-muted" />
          </div>
        </div>
      </div>
      {/* Display name field */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse bg-muted" />
          <div className="h-9 w-full animate-pulse bg-muted" />
        </div>
        {/* Email field */}
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-12 animate-pulse bg-muted" />
          <div className="h-9 w-full animate-pulse bg-muted" />
          <div className="h-3 w-40 animate-pulse bg-muted" />
        </div>
        {/* Save button */}
        <div className="h-9 w-28 animate-pulse bg-muted" />
      </div>
      {/* Separator + Change password */}
      <div className="mt-8 h-px w-full bg-muted" />
      <div className="mt-8 flex flex-col gap-3">
        <div className="h-4 w-32 animate-pulse bg-muted" />
        <div className="h-3 w-64 animate-pulse bg-muted" />
      </div>
      {/* Separator + Danger zone */}
      <div className="mt-8 h-px w-full bg-muted" />
      <div className="mt-8 flex flex-col gap-3">
        <div className="h-4 w-24 animate-pulse bg-muted" />
        <div className="h-3 w-72 animate-pulse bg-muted" />
        <div className="h-8 w-36 animate-pulse bg-muted" />
      </div>
    </div>
  );
}
